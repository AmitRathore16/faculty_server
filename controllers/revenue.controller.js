import PaymentIntent from "../models/paymentIntent.js";

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const buildBaseMatch = ({ status, productType, dateFrom, dateTo, search }) => {
  const match = {};

  // Status filtering (default to succeeded)
  if (status && status !== "all") {
    const statuses = status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length) {
      match.status = { $in: statuses };
    }
  } else if (!status) {
    match.status = { $in: ["succeeded"] };
  }

  // Product type filter
  if (productType) {
    const types = productType
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length) {
      match.productType = { $in: types };
    }
  }

  // Date range filter
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  // Text search across student name/email, product title, receipt, payment/order ids
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    match.$or = [
      { "metadata.studentName": regex },
      { "metadata.studentEmail": regex },
      { "productSnapshot.title": regex },
      { receipt: regex },
      { razorpayPaymentId: regex },
      { razorpayOrderId: regex },
    ];
  }

  return match;
};

const toRupees = (paise = 0) => Math.round(paise) / 100;

export const getRevenueSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo, productType, search } = req.query;

    const match = buildBaseMatch({
      status: "all",
      productType,
      dateFrom,
      dateTo,
      search,
    });

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalSucceeded: {
            $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, "$amount", 0] },
          },
          totalRefunded: {
            $sum: { $cond: [{ $eq: ["$status", "refunded"] }, "$amount", 0] },
          },
          totalFailed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, "$amount", 0] },
          },
          totalTransactions: { $sum: 1 },
        },
      },
    ];

    const [summary] = await PaymentIntent.aggregate(pipeline);

    res.json({
      success: true,
      data: {
        totalRevenue: toRupees(summary?.totalSucceeded || 0),
        totalRefunded: toRupees(summary?.totalRefunded || 0),
        totalFailed: toRupees(summary?.totalFailed || 0),
        totalTransactions: summary?.totalTransactions || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching revenue summary:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch revenue summary",
    });
  }
};

export const getRevenueByMonth = async (req, res) => {
  try {
    const { dateFrom, dateTo, productType } = req.query;

    // Default range: last 12 months if no explicit date range
    const to = parseDate(dateTo) || new Date();
    const from =
      parseDate(dateFrom) || new Date(new Date().setMonth(to.getMonth() - 11));

    const match = buildBaseMatch({
      status: "succeeded",
      productType,
      dateFrom: from,
      dateTo: to,
    });

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ];

    const results = await PaymentIntent.aggregate(pipeline);

    const data = results.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      revenue: toRupees(item.revenue || 0),
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching monthly revenue:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch monthly revenue",
    });
  }
};

export const getRevenueByType = async (req, res) => {
  try {
    const { dateFrom, dateTo, productType } = req.query;

    const match = buildBaseMatch({
      status: "succeeded",
      productType,
      dateFrom,
      dateTo,
    });

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: "$productType",
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { revenue: -1 } },
    ];

    const results = await PaymentIntent.aggregate(pipeline);

    const data = results.map((item) => ({
      type: item._id,
      revenue: toRupees(item.revenue || 0),
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching revenue by type:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch revenue by type",
    });
  }
};

export const getRevenueTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      productType,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const pageNum = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const match = buildBaseMatch({
      status,
      productType,
      dateFrom,
      dateTo,
      search,
    });

    const total = await PaymentIntent.countDocuments(match);
    const items = await PaymentIntent.find(match)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const transactions = items.map((item) => ({
      id: item._id,
      date: item.createdAt,
      studentName: item.metadata?.studentName || "Unknown",
      studentEmail: item.metadata?.studentEmail || "",
      productTitle: item.productSnapshot?.title || "Untitled",
      productType: item.productType,
      amount: toRupees(item.amount || 0),
      status: item.status,
      paymentId: item.razorpayPaymentId || "",
      orderId: item.razorpayOrderId || "",
      receipt: item.receipt || "",
    }));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / pageSize) || 1,
          totalItems: total,
          pageSize,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching revenue transactions:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch revenue transactions",
    });
  }
};
