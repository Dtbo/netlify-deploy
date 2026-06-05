const mongoose = require('mongoose')
const echartSchema = mongoose.Schema({
    dataset: {
        source: []
    }
})

module.exports = mongoose.model('echart', echartSchema)