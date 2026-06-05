const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    userId: String,
    type: {
        type: String,
        default: 'img'
    },
    path: String,
    createTime: {
        type: Date,
        default: Date.now
    },
    updateTime: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('upload', uploadSchema);
