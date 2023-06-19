const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config()
var jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

//middle wares

app.use(express.json());
app.use(cors());

const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }

    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'Unauthorized access' })
        }
        req.decoded = decoded
        next();
    });
}


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

        const usersCollection = client.db("bistrodb").collection("users");
        const menuCollection = client.db("bistrodb").collection("menu");
        const reviewCollection = client.db("bistrodb").collection("reviews");
        const cartCollection = client.db("bistrodb").collection("carts");
        const paymentCollection = client.db("bistrodb").collection("payments");

        app.post('/jwt', (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            const result = { token }
            res.send(result)
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user?.roll !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existUser = await usersCollection.findOne(query);
            if (existUser) {
                return { message: 'user already exists' }
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get('/users', verifyJwt, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const result = { admin: user?.roll === 'admin' }
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    roll: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        app.post('/carts', async (req, res) => {
            const item = req.body
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })

        app.get('/carts', verifyJwt, async (req, res) => {
            const email = req.query.email
            // console.log(email)
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        app.post("/create-payment-intent", verifyJwt, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            console.log(price, amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payments', verifyJwt, async (req, res) => {
            const payment = req.body;
            const InsertResult = await paymentCollection.insertOne(payment);
            const query = { _id: { $in: payment.CartItems.map(id => new ObjectId(id)) } }
            const deleteResult = await cartCollection.deleteMany(query);
            res.send({ InsertResult, deleteResult });
        })

        app.get('/admin-stats', async (req, res) => {
            const users = await usersCollection.estimatedDocumentCount();
            const products = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();
            const payment = await paymentCollection.find().toArray();
            const revenue = payment.reduce((sum, item)=> sum + item.price, 0);
            res.send({
                users,
                products,
                orders,
                revenue
            })
        })

        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        app.post('/menu', verifyJwt, verifyAdmin, async (req, res) => {
            const newItem = req.body;
            const result = await menuCollection.insertOne(newItem);
            res.send(result);
        })

        app.delete('/menu/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/review', async (req, res) => {
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