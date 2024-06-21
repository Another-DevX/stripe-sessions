const express = require("express");
const Stripe = require("stripe");
const dotenv = require("dotenv");
const cors = require("cors");
const ethers = require("ethers");

dotenv.config();
const app = express();
const PORT = 8080 || process.env.PORT;
const RPC_URL = process.env.RPC_URL;
const FARRA_KEY = process.env.FARRA_KEY;

const provider = new ethers.JsonRpcProvider(RPC_URL)
const base_provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
// Get write access as an account by getting the signer
const signer = new ethers.Wallet(FARRA_KEY, base_provider);

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
  "function claim(address _reciver, uint _quantity, address _currency, uint256 _pricePerToken)",
]

// https://base-sepolia.blockscout.com/address/0xc0322f7E240D347f962bc0a9666dE968f4352895?tab=write_contract
const contract = (contractAddress) => (new ethers.Contract(contractAddress, ABI, base_provider));
console.log("Contract Address -->> ", contract("0xc0322f7E240D347f962bc0a9666dE968f4352895"));

const contractWithSigner = contract.connect(signer)

app.post("/mint_by_stripe", async (req, res) => {
  try {
    const { tx_hash, customer_email, customer_wallet_address } = req.body;
    console.log("transaction_details: ", tx_hash);
    console.log("customer_email: ", customer_email);
    const stripe_bought_tx = provider.getTransactionResult(tx_hash).then((result) => {
      console.log("Transaction Result: ", result);
      return result;
    });
    console.log("stripe_bought_tx: ", stripe_bought_tx);
    console.log('Calling transfer function...')
    const transactionResponse = await contractWithSigner.claim(
      customer_wallet_address,
      1,
      "0xf8b414eFD8CB72097edAb449CeAd5dB10Fc12d99",
      "1000000000000000000"
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

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
