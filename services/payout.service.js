import PaymentIntent from "../models/paymentIntent.js";
import Course from "../models/course.js";
import Webinar from "../models/webinar.js";
import TestSeries from "../models/testSeries.js";
import Test from "../models/test.js";
import Payout from "../models/payout.js";

const COMMISSION_PERCENTAGE = 20;

const getEducatorIdFromProduct = async (productId, productType) => {
  try {
    let product;
    if (productType === "course") {
      product = await Course.findById(productId).select("educatorID");
      return product?.educatorID;
    } else if (productType === "webinar") {
      product = await Webinar.findById(productId).select("educatorID");
      return product?.educatorID;
    } else if (productType === "testSeries") {
      product = await TestSeries.findById(productId).select("educatorId");
      return product?.educatorId;
    } else if (productType === "test") {
      product = await Test.findById(productId).select("educatorID");
      return product?.educatorID;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching product ${productId} (${productType}):`, error);
    return null;
  }
};

export const calculatePayoutsForMonth = async (month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  console.log(`Calculating payouts for ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // 1. Aggregate successful payments
  const successfulPayments = await PaymentIntent.find({
    status: "succeeded",
    createdAt: { $gte: startDate, $lte: endDate },
  });

  // 2. Map Revenue to Educators
  const educatorRevenueMap = {};

  for (const payment of successfulPayments) {
    const { productId, productType, amount } = payment;

    // Find educator
    const educatorIdObj = await getEducatorIdFromProduct(productId, productType);
    
    if (!educatorIdObj) continue;

    const educatorId = educatorIdObj.toString();

    if (!educatorRevenueMap[educatorId]) {
      educatorRevenueMap[educatorId] = { gross: 0, commission: 0, payable: 0 };
    }

    const commission = Math.round((amount * COMMISSION_PERCENTAGE) / 100);
    const payable = amount - commission;

    educatorRevenueMap[educatorId].gross += amount;
    educatorRevenueMap[educatorId].commission += commission;
    educatorRevenueMap[educatorId].payable += payable;
  }

  // 3. Create or Update Payout Records
  const payoutRecords = [];

  for (const [educatorId, data] of Object.entries(educatorRevenueMap)) {
    const payoutCheckId = `PAYOUT_${year}_${month}_${educatorId}`;

    let payout = await Payout.findOne({ payoutCheckId });

    if (payout) {
      if (payout.status === "pending") {
        payout.grossAmount = data.gross;
        payout.commissionAmount = data.commission;
        payout.amount = data.payable;
        await payout.save();
        payoutRecords.push(payout);
      }
    } else {
      payout = await Payout.create({
        educatorId,
        amount: data.payable,
        grossAmount: data.gross,
        commissionAmount: data.commission,
        month,
        year,
        payoutCheckId,
        scheduledDate: new Date(),
        status: "pending",
      });
      payoutRecords.push(payout);
    }
  }

  return payoutRecords;
};
