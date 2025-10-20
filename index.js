// ================================
//  ParcelBD Server - Express + MongoDB
// ================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

const app = express();
const port = process.env.PORT || 4000;

// -------------------------------
// Middleware
// -------------------------------
const corsOptions = {
  origin: ["http://localhost:5173"], // React app URL
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// -------------------------------
// MongoDB Connection
// -------------------------------
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_PASS}@cluster0.dcadkw6.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// -------------------------------
// Main Function
// -------------------------------
async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully!");

    const db = client.db("parcelBD");
    const parcelCollection = db.collection("parcels");
    const paymentHistoryCollection = db.collection("paymentHistory");

    // -------------------------------
    // GET parcels (all or by user email, latest first)
    // -------------------------------
    app.get("/parcels", async (req, res) => {
      try {
        const { email } = req.query;
        const filter = email ? { user_email: email } : {};

        const parcels = await parcelCollection
          .find(filter)
          .sort({ _id: -1 })
          .toArray();

        res.send(parcels);
      } catch (error) {
        console.error("Error fetching parcels:", error);
        res.status(500).send({ message: "Failed to fetch parcels", error });
      }
    });

    // -------------------------------
    // GET - Single Parcel by ID
    // -------------------------------
    app.get("/parcels/:parcelId", async (req, res) => {
      try {
        const id = req.params.parcelId;
        const parcel = await parcelCollection.findOne({ _id: new ObjectId(id) });

        if (!parcel) {
          return res.status(404).send({ message: "Parcel not found" });
        }

        res.send(parcel);
      } catch (error) {
        console.error("Error fetching parcel by ID:", error);
        res.status(500).send({ message: "Failed to fetch parcel", error });
      }
    });

    // -------------------------------
    // POST - Add a new parcel
    // -------------------------------
    app.post("/parcels", async (req, res) => {
      try {
        const newParcel = req.body;
        if (!newParcel.sender_name || !newParcel.receiver_name) {
          return res.status(400).send({ message: "Sender & Receiver required!" });
        }

        const result = await parcelCollection.insertOne(newParcel);
        res.send(result);
      } catch (error) {
        console.error("Error adding parcel:", error);
        res.status(500).send({ message: "Failed to add parcel", error });
      }
    });

    // -------------------------------
    // PUT - Update parcel
    // -------------------------------
    app.put("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedParcel = req.body;
        const result = await parcelCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedParcel }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update parcel", error });
      }
    });

    // -------------------------------
    // DELETE - Remove parcel
    // -------------------------------
    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await parcelCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete parcel", error });
      }
    });

    // -------------------------------
    // Stripe - Create Payment Intent
    // -------------------------------
    app.post("/create-payment-intent", async (req, res) => {
      const amountInCents = req.body.amountInCents;

      if (!amountInCents) {
        return res.status(400).json({ error: "Amount is required" });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Stripe error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // -------------------------------
    // Mark Parcel as Paid
    // -------------------------------
    app.post("/parcels/:id/paid", async (req, res) => {
      try {
        const parcelId = req.params.id;

        const updateParcel = await parcelCollection.updateOne(
          { _id: new ObjectId(parcelId) },
          { $set: { payment_status: "paid", paidAt: new Date() } }
        );

        if (updateParcel.modifiedCount === 0) {
          return res.status(404).send({ message: "Parcel not found or already paid" });
        }

        res.status(200).send({ message: "Parcel marked as paid", updateParcel });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // -------------------------------
    // Save Payment History
    // -------------------------------
    app.post("/payments/history", async (req, res) => {
      try {
        const { parcelId, userEmail, amount, paymentIntentId } = req.body;

        const paymentHistory = {
          parcelId,
          userEmail,
          amount,
          paymentIntentId,
          paymentStatus: "paid",
          createdAt: new Date(),
        };

        const result = await paymentHistoryCollection.insertOne(paymentHistory);

        res.status(201).send({ message: "Payment history saved successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // -------------------------------
    // Get User Payment History
    // -------------------------------
    app.get("/payments/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const history = await paymentHistoryCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(history);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // -------------------------------
    // Get All Payment History (Admin)
    // -------------------------------
    app.get("/payments/all", async (req, res) => {
      try {
        const history = await paymentHistoryCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(history);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // -------------------------------
    // Default route
    // -------------------------------
    app.get("/", (req, res) => {
      res.send("ParcelBD Server is running...");
    });

  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}

run().catch(console.dir);

// -------------------------------
// Start server
// -------------------------------
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
