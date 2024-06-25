const express = require("express");
const Stripe = require("stripe");
const dotenv = require("dotenv");
const cors = require("cors");
const ethers = require("ethers");
const { Resend } = require("resend");

dotenv.config();
const app = express();
const PORT = 8080 || process.env.PORT;
const RPC_URL = process.env.RPC_URL;
const FARRA_KEY = process.env.FARRA_KEY;
const BASE_RPC_URL = process.env.BASE_RPC_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const provider = new ethers.JsonRpcProvider(RPC_URL)
const base_provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
// Get write access as an account by getting the signer
const signer = new ethers.Wallet(FARRA_KEY, base_provider);
const resend = new Resend(RESEND_API_KEY);

// This is your test secret API key.
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const OnrampSessionResource = Stripe.StripeResource.extend({
  create: Stripe.StripeResource.method({
    method: 'POST',
    path: 'crypto/onramp_sessions',
  }),
});

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

app.post("/create-onramp-session", async (req, res) => {
  try {
    const { transaction_details, customer_information } = req.body;

    console.log("transaction_details: ", customer_information);
    // Create an OnrampSession with the order amount and currency
    const onrampSession = await new OnrampSessionResource(stripe).create({
      transaction_details: {
        destination_currency: transaction_details["destination_currency"],
        destination_exchange_amount: transaction_details["destination_exchange_amount"],
        destination_network: "ethereum", // transaction_details["destination_network"],
        wallet_addresses: { ethereum: "0xf8b414eFD8CB72097edAb449CeAd5dB10Fc12d99" }, // transaction_details["wallet_address"] },
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
  } catch (error) {
    console.log("[ Error !!!]: ", error);
    res.send({ message: "Error Occured" }).status(500);
  }
});

const ABI = [
  "function ownerOf(uint tokenId) view returns (address)",
  "function balanceOf(address addr) view returns (uint)",
  "function claim(address _receiver, uint256 _quantity, address _currency, uint256 _pricePerToken, (bytes32[],uint256,uint256,address) _allowlistProof, bytes _data)",
]

// https://base-sepolia.blockscout.com/address/0xc0322f7E240D347f962bc0a9666dE968f4352895?tab=write_contract
const getContract = () => {
  return new ethers.Contract("0xFf28015E395aD24EFAA1f0Ea33Bb409B043a0bea", ABI, signer);
};
const contract = getContract();

app.post("/mint_by_stripe", async (req, res) => {
  try {
    const { tx_hash, customer_email, customer_wallet_address } = req.body;
    console.log("transaction_details: ", tx_hash);
    console.log("customer_email: ", customer_email);
    await provider.getTransactionReceipt(tx_hash).then((result) => {
      console.log("Transaction Result: ", result.status);
      return result;
    });
    console.log('Calling transfer function...')
    const transactionResponse = await contract.claim(
      customer_wallet_address,
      1,
      "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      "1000000",
      [
        [
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ],
        "100000",
        "1000000",
        "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
      ],
      "0x"
    )
    await transactionResponse.wait();
    // We could send a qr code to the user to scan and claim the ticket
    console.log(`Transaction hash: ${transactionResponse.hash}`)

    res.send({
      transaction_hash: transactionResponse.hash,
    });
  } catch (error) {
    console.log("[ Error !!!]: ", error);
    res.send({ message: "Error Occured" }).status(500);
  }
})

app.post("/send-ticket", async (req, res) => {
  try {
    const { customer_email, customer_wallet_address } = req.body;
    console.log("customer_email: ", customer_email);
    console.log("customer_wallet_address: ", customer_wallet_address);
    // send the ticket to the customer emai with sendgrid
    const { data, error } = await resend.emails.send({
      from: "Farra <nounish@ticket.dev>",
      to: [customer_email],
      subject: "Ticket Purchase Confirmation",
      html: "<strong>it works!</strong>",
    });
    if (error) {
      return res.status(400).json({ error });
    }
  
    res.status(200).json({ data });
    
  } catch (error) {
    console.log("[ Error !!!]: ", error);
    res.send({ message: "Error Occured" }).status(500);
  }
})

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
