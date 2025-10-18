// ================================
//  ParcelBD Server - Express + MongoDB
// ================================

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);

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

    // -------------------------------
    // GET parcels (all or by user email, latest first)
    // -------------------------------
    app.get("/parcels", async (req, res) => {
      try {
        const { email } = req.query; // get email from query parameter

        // Build filter
        const filter = email ? { user_email: email } : {};

        const parcels = await parcelCollection
          .find(filter)
          .sort({ _id: -1 }) // newest first
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
        const query = { _id: new ObjectId(id) };
        const parcel = await parcelCollection.findOne(query);

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
        console.log("Incoming parcel:", newParcel);

        if (!newParcel.sender_name || !newParcel.receiver_name) {
          return res
            .status(400)
            .send({ message: "Sender & Receiver required!" });
        }

        const result = await parcelCollection.insertOne(newParcel);
        console.log("Inserted:", result.insertedId);
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
        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: updatedParcel };
        const result = await parcelCollection.updateOne(query, updateDoc);
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
        const query = { _id: new ObjectId(id) };
        const result = await parcelCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete parcel", error });
      }
    });

    /*****stripe.js */
app.post('/create-payment-intent', async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1099,  // amount in cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      }
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



    // -------------------------------
    // Default route
    // -------------------------------
    app.get("/", (req, res) => {
      res.send("ParcelBD Server is running...");
    });
  } catch (error) {
    console.error(" MongoDB connection failed:", error);
  }
}
run().catch(console.dir);

// -------------------------------
// Start server
// -------------------------------
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
