const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Address = require("./schemas/ContractSchema");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb+srv://rajatrandai7_db_user:8408900279rR@cluster0.hv0c6fu.mongodb.net")
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.error("MongoDB connection failed:", err.message);
    });

app.get("/", (req, res) => {
    res.send("Working fine!");
});

app.post("/update", async (req, res) => {
    try {
        const { newaddress } = req.body;

        if (!newaddress) {
            return res.status(400).json({
                message: "Address is required"
            });
        }

        // Update the latest address in the database
        const savedAddress = await Address.findOneAndUpdate(
            {},
            { addr: newaddress },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        console.log("Saved address:", savedAddress.addr);

        res.json({
            message: "Address saved successfully",
            address: savedAddress.addr
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: error.message
        });
    }
});

app.get("/address", async (req, res) => {
    try {
        // Fetch the latest address from MongoDB
        const latestAddress = await Address.findOne().sort({ _id: -1 });

        if (!latestAddress) {
            return res.status(404).json({
                message: "No address found in database"
            });
        }

        res.json({
            address: latestAddress.addr
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});


