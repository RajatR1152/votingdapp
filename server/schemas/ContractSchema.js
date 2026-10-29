const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    addr: {
        type: String,
        required: true
    }
});

const Address = mongoose.model("Address", contractSchema);

module.exports = Address;