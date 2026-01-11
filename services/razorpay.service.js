import { getRazorpayClient } from "../config/razorpay.js";

// Create a contact in Razorpay
export const createContact = async (educator) => {
  const razorpay = getRazorpayClient();
  try {
    const contact = await razorpay.contacts.create({
      name: educator.fullName || `${educator.firstName} ${educator.lastName}`,
      email: educator.email,
      contact: educator.mobileNumber,
      type: "vendor",
      reference_id: educator._id.toString(),
      notes: {
        source: "facultypedia_educator",
      },
    });
    return contact;
  } catch (error) {
    throw new Error(`Razorpay Contact Creation Failed: ${error.message}`);
  }
};

// Create a fund account for a contact
export const createFundAccount = async (contactId, bankDetails) => {
  const razorpay = getRazorpayClient();
  try {
    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: bankDetails.accountHolderName,
        ifsc: bankDetails.ifscCode,
        account_number: bankDetails.accountNumber,
      },
    });
    return fundAccount;
  } catch (error) {
    throw new Error(`Razorpay Fund Account Creation Failed: ${error.message}`);
  }
};

// Initiate a payout
export const createPayout = async (payoutData) => {
  const razorpay = getRazorpayClient();
  try {
    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: payoutData.fundAccountId,
      amount: payoutData.amount, // Amount in paise
      currency: payoutData.currency || "INR",
      mode: "IMPS",
      purpose: "vendor_payout",
      queue_if_low_balance: true,
      reference_id: payoutData.referenceId,
      narration: payoutData.narration || "Payout",
      notes: payoutData.notes || {},
    });
    return payout;
  } catch (error) {
    throw new Error(`Razorpay Payout Creation Failed: ${error.message}`);
  }
};
