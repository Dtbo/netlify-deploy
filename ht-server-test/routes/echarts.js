const router = require('koa-router')()
const Echart = require('../model/echartsSchema.js')
const utils = require('../utils/utils.js')

router.prefix('/echarts')

//用户列表渲染
router.get('/list', async (ctx) => {
    try {
        let params = {};
        let res = await Echart.find(params)
        ctx.body = utils.success(res)
    } catch (err) {
        console.log(err)
    }
})

module.exports = router