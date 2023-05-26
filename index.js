const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
require('dotenv').config()
const cors = require('cors');
const port = process.env.PORT || 5000;

//middle wares

app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bistrodb.qahtzwk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)

        const menuCollection = client.db("bistrodb").collection("menu");
        const reviewCollection = client.db("bistrodb").collection("reviews");

        app.get('/menu', async(req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        app.get('/review', async(req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bistro server is running')
})

app.listen(port, () => {
    console.log(`listening on port ${port}`)
})