import cron from "node-cron";
import { calculatePayoutsForMonth } from "../services/payout.service.js";

const initializePayoutCron = () => {
  // Run at 00:00 on the 1st day of every month
  cron.schedule("0 0 1 * *", async () => {
    console.log("Running Monthly Payout Calculation Job...");
    
    try {
      const today = new Date();
      // Calculate for previous month
      // If today is Jan 1st 2024 (Month 0). We want Dec 2023.
      
      let month = today.getMonth(); // 0-11
      let year = today.getFullYear();
      
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      // If today is Feb (1), month becomes 1 (Jan), year same.
      
      // Note: calculatePayoutsForMonth expects 1-12 for month
      console.log(`Calculating for Month: ${month}, Year: ${year}`);
      
      await calculatePayoutsForMonth(month, year);
      
      console.log("Monthly Payout Calculation Completed Successfully.");
    } catch (error) {
      console.error("Error in Monthly Payout job:", error);
    }
  });

  console.log("Payout Cron Job Initialized (Schedule: 0 0 1 * *)");
};

export default initializePayoutCron;
