const express = require("express");
const Stripe = require("stripe");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();
const PORT = 8080 || process.env.PORT;

// This is your test secret API key.
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const OnrampSessionResource = Stripe.StripeResource.extend({
  create: Stripe.StripeResource.method({
    method: 'POST',
    path: 'crypto/onramp_sessions',
  }),
});

// const corsOptions = {
//     origin: 'http://localhost:5173/',
//     optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
// }

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

app.post("/create-onramp-session", async (req, res) => {
    const { transaction_details, customer_information } = req.body;
  
    console.log("transaction_details: ", customer_information);
    // Create an OnrampSession with the order amount and currency
    const onrampSession = await new OnrampSessionResource(stripe).create({
      transaction_details: {
        destination_currency: transaction_details["destination_currency"],
        destination_exchange_amount: transaction_details["destination_exchange_amount"],
        destination_network: "ethereum", // transaction_details["destination_network"],
        wallet_addresses: { ethereum: transaction_details["wallet_address"] },
      },
      customer_information: {
        email: customer_information["email"],
        first_name: customer_information["first_name"],
        last_name: customer_information["last_name"],
        dob: {
          day: customer_information["dob"]["day"],
          month: customer_information["dob"]["month"],
          year: customer_information["dob"]["year"],
        },
      },
      destination_currencies: transaction_details["destination_currencies"],
      destination_networks: ['ethereum', 'avalanche']
    });
  
    console.log("--->> ", onrampSession);
    res.send({
      clientSecret: onrampSession.client_secret,
    });
  });

  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
