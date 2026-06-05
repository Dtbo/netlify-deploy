const mongoose = require('mongoose')
const {
    Schema
} = mongoose;

const userSchema = new Schema({
    nickname: String,
    avatar: String,
    session_key: String,
    openid: String,
    token: String,
    createTime: {
        type: Date, default: Date.now
    },
    lastLoginTime: {
        type: Date, default: Date.now
    }
});
module.exports = mongoose.model('user', userSchema);