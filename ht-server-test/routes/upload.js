/**
 * 上传模块
 */
const router = require('koa-router')()
const Upload = require('./../model/uploadSchema')
const utils = require('./../utils/utils')
const fs = require('fs')
const path = require('path')
const multer = require('@koa/multer')

router.prefix('/uploads')

function getOperator(ctx) {
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization
    if (!authorization) return null
    try {
        return utils.decoded(authorization)
    } catch {
        return null
    }
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

function toPublicPath(relativePath) {
    return relativePath.replace(/\\/g, '/')
}

const upload = multer({
    storage: multer.diskStorage({
        destination(req, file, cb) {
            const dir = './public/images'
            ensureDir(dir)
            cb(null, dir)
        },
        filename(req, file, cb) {
            const fileName = `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
            cb(null, fileName)
        }
    })
})

// 普通图片上传
router.post('/img', upload.single('avatar'), async (ctx) => {
    const operator = getOperator(ctx)
    if (!ctx.request.file) {
        ctx.body = utils.fail('未收到上传文件')
        return
    }

    const filePath = toPublicPath(ctx.request.file.path.replace(/^public/, ''))
    const res = await Upload.create({
        userId: operator?.userId ? String(operator.userId) : '',
        type: 'img',
        path: filePath
    })
    ctx.body = utils.success(res)
})

// 获取普通图片列表
router.get('/img2', async (ctx) => {
    const operator = getOperator(ctx)
    const query = operator?.userId ? { type: 'img', userId: String(operator.userId) } : { type: 'img' }
    const res = await Upload.find(query).sort({ createTime: -1 })
    ctx.body = utils.success(res)
})

// 电子签名上传（base64）
router.post('/sign', async (ctx) => {
    const operator = getOperator(ctx)
    if (!operator?.userId) {
        ctx.body = utils.fail('用户未登录')
        return
    }

    const { image } = ctx.request.body || {}
    if (!image || typeof image !== 'string') {
        ctx.body = utils.fail('签名数据不能为空')
        return
    }

    const base64 = image.replace(/^data:image\/\w+;base64,/, '')
    if (!base64) {
        ctx.body = utils.fail('签名格式不正确')
        return
    }

    try {
        const dir = './public/images/signs'
        ensureDir(dir)
        const filename = `sign-${operator.userId}-${Date.now()}.png`
        const diskPath = path.join(dir, filename)
        fs.writeFileSync(diskPath, Buffer.from(base64, 'base64'))

        const publicPath = `/images/signs/${filename}`
        const doc = await Upload.create({
            userId: String(operator.userId),
            type: 'sign',
            path: publicPath
        })

        ctx.body = utils.success({
            _id: doc._id,
            path: publicPath,
            createTime: doc.createTime
        }, '签名保存成功')
    } catch (error) {
        console.log('签名上传失败:', error)
        ctx.body = utils.fail('签名保存失败')
    }
})

// 获取当前用户签名列表
router.get('/sign/list', async (ctx) => {
    const operator = getOperator(ctx)
    if (!operator?.userId) {
        ctx.body = utils.fail('用户未登录')
        return
    }

    const list = await Upload.find({
        userId: String(operator.userId),
        type: 'sign'
    }).sort({ createTime: -1 })

    ctx.body = utils.success(list)
})

module.exports = router
