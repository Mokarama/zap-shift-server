const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const port = process.env.PORT || 4000;

const { MongoClient, ServerApiVersion } = require('mongodb');

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_PASS}@cluster0.dcadkw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const db = client.db('parcelBD'); // database
    const parcelCollection = db.collection('parcels'); // collection

    // GET all parcels
    app.get('/parcels', async (req, res) => {
      const parcels = await parcelCollection.find().toArray();
      res.send(parcels);
    });

    // POST a new parcel
    app.post('/parcels', async (req, res) => {
      const newParcel = req.body;
      const result = await parcelCollection.insertOne(newParcel);
      res.send(result);
    });

    console.log("✅ Connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

// Sample route
app.get('/', (req, res) => {
  res.send('Parcel Server is running');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
