import cron from "cron";
import https from "https";

const job = new cron.CronJob("*/14 * * * *", function (){
    https
        .get(process.env.API_URL, (res) => {
            if(res.statusCode === 200)  console.log("GET request successfully!");
            else console.log("GET request failed!", res.statusCode);
        })
        .on("error", (e) => console.error("Error with GET request:", e.message));
    
});

export default job;

//! MINUTE, HOUR, DAY OF THE MONTH, MONTH, DAY OF THE WEEK

//? EXAMPLES && EXPLANATION:
//* 14 * * * *  => At minute 14 past every hour
//* 0 0 * * 0 => At midnight on every Sunday
//* 0 0 * * * => At midnight every day
//* 0 0 * * 1 => At midnight on every Monday
//* 0 0 1 * * => At midnight on the first day of every month
//* 0 0 1 1 * => At midnight on the first day of January every year
