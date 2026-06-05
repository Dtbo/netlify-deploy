
const router = require('koa-router')()
const leave = require('../model/leaveSchema.js')
const utils = require('../utils/utils.js')
const Dept = require('../model/deptSchema.js')
router.prefix('/leaves')

// 审批休假列表渲染
router.get('/list', async (ctx) => {
    const { applyState, type } = ctx.request.query
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization
    let data = utils.decoded(authorization)

    if (!data || !data.userId) {
        ctx.body = utils.fail('用户未登录')
        return
    }

    const { page, skipIndex } = utils.pager(ctx.request.query)

    try {
        let params = {}

        if (type == 'approve') {
            // 待审批管理页面：按审批角色与进度展示
            const state = applyState ? parseInt(applyState) : 0
            const userId = String(data.userId)
            const userName = data.userName
            const flowMatch = { 'auditFlows.userId': userId }

            if (state === 1) {
                // 待审批：轮到我且尚未开始多级审批
                params = {
                    ...flowMatch,
                    applyState: 1,
                    curAuditUserName: userName
                }
            } else if (state === 2) {
                // 审批中：轮到我审批，或我已通过但后续审批人尚未完成
                params = {
                    ...flowMatch,
                    applyState: 2,
                    $or: [
                        { curAuditUserName: userName },
                        {
                            'auditLogs.userId': userId,
                            curAuditUserName: { $ne: userName }
                        }
                    ]
                }
            } else if (state === 3 || state === 4) {
                // 审批通过/拒绝：我已参与且流程已结束
                params = {
                    ...flowMatch,
                    applyState: state,
                    'auditLogs.userId': userId
                }
            } else if (state === 5) {
                ctx.body = utils.success({ list: [], total: 0 })
                return
            } else {
                // 全部：待我审批 + 我跟进的审批中 + 我已参与的已完成
                params = {
                    ...flowMatch,
                    $or: [
                        { curAuditUserName: userName, applyState: { $in: [1, 2] } },
                        {
                            applyState: 2,
                            'auditLogs.userId': userId,
                            curAuditUserName: { $ne: userName }
                        },
                        {
                            applyState: { $in: [3, 4] },
                            'auditLogs.userId': userId
                        }
                    ]
                }
            }
        } else {
            // 休假管理页面：只显示当前用户提交的申请
            params = { 'applyUser.userId': String(data.userId) }
            if (applyState && applyState != 0) {
                params.applyState = parseInt(applyState)
            }
        }

        let query = leave.find(params).sort({ createTime: -1 })
        let list = await query.skip(skipIndex).limit(page.pagesize)
        let total = await leave.countDocuments(params)
        ctx.body = utils.success({ list, total })
    } catch (err) {
        console.log(err)
        ctx.body = utils.fail('查询失败')
    }
})

// 查询单条休假记录
router.get('/detail', async (ctx) => {
    const { _id } = ctx.request.query
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization
    let data = utils.decoded(authorization)

    try {
        if (!data || !data.userId) {
            ctx.body = utils.fail('用户未登录')
            return
        }

        if (!_id) {
            ctx.body = utils.fail('记录ID不能为空')
            return
        }

        let leaveDoc = await leave.findById(_id)

        if (!leaveDoc) {
            ctx.body = utils.fail('记录不存在')
            return
        }

        const isApplicant = leaveDoc.applyUser?.userId === String(data.userId)
        const isAuditor = leaveDoc.auditFlows?.some(item => item.userId === String(data.userId))
        const isAdmin = parseInt(data.role) === 0

        if (!isApplicant && !isAuditor && !isAdmin) {
            ctx.body = utils.fail('无权查看该记录')
            return
        }

        ctx.body = utils.success(leaveDoc)
    } catch (err) {
        console.log(err)
        ctx.body = utils.fail('查询失败')
    }
})

// 审批休假列表创建 & 作废
router.post('/operate', async (ctx) => {
    const { _id, action, ...params } = ctx.request.body
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization
    let data = utils.decoded(authorization)

    if (!data || !data.userId) {
        ctx.body = utils.fail('用户未登录')
        return
    }

    if (action == 'create') {
        let total = await leave.countDocuments({})
        let orderNo = 'XJ' + utils.formateDate(new Date(), 'yyMMdd') + total
        params.orderNo = orderNo

        let applyUser = {
            userId: String(data.userId),
            userName: data.userName,
            userEmail: data.userEmail || ''
        }

        if (!data.deptId || data.deptId.length === 0) {
            ctx.body = utils.fail('用户未分配部门，无法提交申请')
            return
        }

        let deptId
        if (data.deptId.length == 2) {
            deptId = data.deptId[0]
        } else {
            deptId = data.deptId[data.deptId.length - 2]
        }

        let dept = await Dept.findById(deptId)
        if (!dept) {
            ctx.body = utils.fail('部门信息不存在')
            return
        }

        let auditFlows = [{
            userId: String(dept.userId),
            userName: dept.userName,
            userEmail: dept.userEmail || ''
        }]
        let auditUsers = dept.userName

        let hrAndFinance = await Dept.find({ deptName: { $in: ['人事部门', '财务部门'] } })
        let hrDept = hrAndFinance.find(item => item.deptName === '人事部门')
        let financeDept = hrAndFinance.find(item => item.deptName === '财务部门')

        ;[hrDept, financeDept].filter(Boolean).forEach(item => {
            auditFlows.push({
                userId: String(item.userId),
                userName: item.userName,
                userEmail: item.userEmail || ''
            })
            auditUsers += ',' + item.userName
        })

        params.applyState = 1
        params.curAuditUserName = dept.userName
        params.auditUsers = auditUsers
        params.applyUser = applyUser
        params.auditFlows = auditFlows
        params.auditLogs = []
        params.createTime = new Date()

        let res = await leave.create(params)
        ctx.body = utils.success(res, '提交成功')
    } else if (action == 'drop') {
        let leaveDoc = await leave.findById(_id)
        if (!leaveDoc) {
            ctx.body = utils.fail('记录不存在')
            return
        }

        if (leaveDoc.applyState !== 1) {
            ctx.body = utils.fail('只有待审批状态的申请可以作废')
            return
        }

        if (leaveDoc.applyUser.userId !== String(data.userId)) {
            ctx.body = utils.fail('只能作废自己提交的申请')
            return
        }

        await leave.findByIdAndUpdate(_id, { applyState: 5, curAuditUserName: '' })
        ctx.body = utils.success('', '作废成功')
    }
})

// 审批休假列表作废（兼容旧接口）
router.post('/delete', async (ctx) => {
    const { _id } = ctx.request.body
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization
    let data = utils.decoded(authorization)

    try {
        let leaveDoc = await leave.findById(_id)
        if (!leaveDoc) {
            ctx.body = utils.fail('记录不存在')
            return
        }

        if (leaveDoc.applyState !== 1) {
            ctx.body = utils.fail('只有待审批状态的申请可以作废')
            return
        }

        if (leaveDoc.applyUser.userId !== String(data.userId)) {
            ctx.body = utils.fail('只能作废自己提交的申请')
            return
        }

        await leave.findByIdAndUpdate(_id, { applyState: 5, curAuditUserName: '' })
        ctx.body = utils.success('', '作废成功')
    } catch (error) {
        console.log(error)
        ctx.body = utils.fail('作废失败')
    }
})

const EDIT_WINDOW_MS = 5 * 60 * 1000

function recalculateState(auditFlows, auditLogs) {
    if (!auditLogs.length) {
        return {
            applyState: 1,
            curAuditUserName: auditFlows[0]?.userName || ''
        }
    }

    const lastLog = auditLogs[auditLogs.length - 1]
    if (lastLog.action === 'refuse') {
        return { applyState: 4, curAuditUserName: '' }
    }

    if (auditLogs.length >= auditFlows.length) {
        return { applyState: 3, curAuditUserName: '' }
    }

    return {
        applyState: 2,
        curAuditUserName: auditFlows[auditLogs.length]?.userName || ''
    }
}

function canEditLastLog(doc, userId) {
    if (!doc.auditLogs?.length) {
        return { ok: false, msg: '暂无可修改的审批记录' }
    }

    const lastLog = doc.auditLogs[doc.auditLogs.length - 1]
    if (lastLog.userId !== String(userId)) {
        return { ok: false, msg: '后续审批人已处理，无法修改' }
    }

    const elapsed = Date.now() - new Date(lastLog.createTime).getTime()
    if (elapsed > EDIT_WINDOW_MS) {
        return { ok: false, msg: '已超过5分钟，无法修改审批结果' }
    }

    return { ok: true, lastLog }
}

// 审批审核接口
router.post('/approve', async (ctx) => {
    const { _id, action, remark, newAction, signImg } = ctx.request.body
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization
    let data = utils.decoded(authorization)

    if (!data || !data.userId) {
        ctx.body = utils.fail('用户未登录')
        return
    }

    try {
        let doc = await leave.findById(_id)

        if (!doc) {
            ctx.body = utils.fail('审核失败，记录不存在')
            return
        }

        // 5分钟内修改最近一次审批
        if (action === 'modify') {
            const check = canEditLastLog(doc, data.userId)
            if (!check.ok) {
                ctx.body = utils.fail(check.msg)
                return
            }

            const auditLogs = doc.auditLogs.map((item, index) => {
                const log = item.toObject ? item.toObject() : { ...item }
                if (index !== doc.auditLogs.length - 1) {
                    return log
                }
                if (newAction === 'pass' || newAction === 'refuse') {
                    log.action = newAction
                }
                if (remark !== undefined) {
                    log.remark = remark || ''
                }
                if (signImg) {
                    log.signImg = signImg
                }
                return log
            })

            const stateInfo = recalculateState(doc.auditFlows, auditLogs)
            await leave.findByIdAndUpdate(_id, {
                auditLogs,
                ...stateInfo
            })
            ctx.body = utils.success('', '修改成功')
            return
        }

        if (doc.applyState !== 1 && doc.applyState !== 2) {
            ctx.body = utils.fail('该申请已处理，无法再次审核')
            return
        }

        if (doc.curAuditUserName !== data.userName) {
            ctx.body = utils.fail('您不是当前审批人，无权审核')
            return
        }

        const nextApprover = doc.auditFlows[doc.auditLogs.length]
        if (!nextApprover || nextApprover.userId !== String(data.userId)) {
            ctx.body = utils.fail('您不是当前审批人，无权审核')
            return
        }

        let updateParams = {}

        if (action === 'refuse') {
            if (!signImg) {
                ctx.body = utils.fail('请先完成电子签名')
                return
            }
            updateParams.applyState = 4
            updateParams.curAuditUserName = ''
            updateParams.auditLogs = [
                ...doc.auditLogs,
                {
                    userId: String(data.userId),
                    userName: data.userName,
                    action,
                    remark: remark || '',
                    signImg,
                    createTime: new Date()
                }
            ]
        } else if (action === 'pass') {
            if (!signImg) {
                ctx.body = utils.fail('请先完成电子签名')
                return
            }
            const auditLogs = [
                ...doc.auditLogs,
                {
                    userId: String(data.userId),
                    userName: data.userName,
                    action,
                    remark: remark || '',
                    signImg,
                    createTime: new Date()
                }
            ]
            updateParams.auditLogs = auditLogs
            Object.assign(updateParams, recalculateState(doc.auditFlows, auditLogs))
        } else {
            ctx.body = utils.fail('无效的操作')
            return
        }

        await leave.findByIdAndUpdate(_id, updateParams)
        ctx.body = utils.success('', action === 'refuse' ? '驳回成功' : '审核成功')
    } catch (error) {
        console.log('审核错误:', error)
        ctx.body = utils.fail('审核失败')
    }
})

// 删除不属于自己审批的记录
router.post('/remove', async (ctx) => {
    const { _id } = ctx.request.body
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization
    let data = utils.decoded(authorization)

    if (!data || !data.userId) {
        ctx.body = utils.fail('用户未登录')
        return
    }

    try {
        let leaveDoc = await leave.findById(_id)

        if (!leaveDoc) {
            ctx.body = utils.fail('记录不存在')
            return
        }

        let isInFlow = leaveDoc.auditFlows.some(item => item.userId === String(data.userId))

        if (!isInFlow) {
            ctx.body = utils.fail('无权删除该记录')
            return
        }

        let result = await leave.findByIdAndDelete(_id)

        if (result) {
            ctx.body = utils.success('', '删除成功')
        } else {
            ctx.body = utils.fail('删除失败')
        }
    } catch (error) {
        console.log('删除错误:', error)
        ctx.body = utils.fail('删除失败')
    }
})

module.exports = router
