/**
 * 角色管理路由模块
 * 处理角色相关的所有 API 请求
 * @author Lee
 */

// 引入 koa-router 模块
const router = require('koa-router')();

// 引入角色模型
const Role = require('../model/roleSchema');

// 引入工具函数模块
const utils = require('../utils/utils');
const { isCompanyPermissionAdmin } = require('../utils/deptUser');

// 设置路由前缀
router.prefix('/roles');

/**
 * 角色列表查询接口
 * GET /api/roles/list
 * @param {string} roleName - 角色名称（可选，支持模糊查询）
 * @param {number} currentPage - 当前页码
 * @param {number} pageSize - 每页条数
 * @returns {Object} - 角色列表和总数
 */
router.get('/list', async (ctx) => {
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    if (!operator || !isCompanyPermissionAdmin(operator)) {
        ctx.body = utils.fail('仅青阳子可访问角色管理');
        return;
    }

    var { roleName } = ctx.request.query;
    
    // 解析分页参数
    const { page, skipIndex } = utils.pager(ctx.request.query);
    
    try {
        // 构建查询条件
        let params = {};
        if (roleName) params.roleName = { $regex: roleName };
        
        // 查询角色列表
        let query = Role.find(params);
        let list = await query.skip(skipIndex).limit(page.pagesize);
        let total = await Role.countDocuments(params);
        
        // 返回分页结果
        ctx.body = utils.success({ list, total }, '查询成功');
    } catch (error) {
        // 捕获异常并输出日志
        console.log('查询角色列表异常:', error);
        ctx.body = utils.fail('查询角色列表异常');
    }
});

/**
 * 角色创建/编辑接口
 * POST /api/roles/operate
 * @param {string} _id - 角色ID（编辑时必填）
 * @param {string} roleName - 角色名称（必填）
 * @param {string} remark - 角色备注
 * @param {string} active - 操作类型（'create'：创建，其他：编辑）
 * @returns {Object} - 操作结果
 */
router.post('/operate', async (ctx) => {
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    if (!operator || !isCompanyPermissionAdmin(operator)) {
        ctx.body = utils.fail('仅青阳子可操作角色');
        return;
    }

    const params = ctx.request.body;
    const { roleName, active, _id } = params;
    
    try {
        // 创建角色
        if (active == 'create') {
            // 参数验证
            if (!roleName) {
                ctx.body = utils.fail('参数错误：角色名称不能为空');
                return;
            }
            
            // 检查角色名称是否重复
            let res = await Role.findOne({ roleName }, '_id roleName');
            
            if (res) {
                ctx.body = utils.fail('角色已存在，请重新填写');
                return;
            }
            
            // 创建新角色
            let resCreate = await Role.create(params);
            
            // 返回成功结果
            ctx.body = utils.success('角色创建成功');
        } else {
            // 编辑角色
            let res = await Role.findOneAndUpdate({ _id }, params);
            
            // 返回成功结果
            ctx.body = utils.success('更新成功');
        }
    } catch (error) {
        // 捕获异常并输出日志
        console.log('角色操作异常:', error);
        ctx.body = utils.fail('角色操作异常');
    }
});

/**
 * 角色删除接口
 * POST /api/roles/delete
 * @param {string} _id - 角色ID
 * @returns {Object} - 删除结果
 */
router.post('/delete', async (ctx) => {
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    if (!operator || !isCompanyPermissionAdmin(operator)) {
        ctx.body = utils.fail('仅青阳子可删除角色');
        return;
    }

    var { _id } = ctx.request.body;
    
    try {
        // 根据ID删除角色
        let res = await Role.findByIdAndDelete(_id);
        
        // 返回删除结果
        ctx.body = utils.success('删除成功');
    } catch (error) {
        // 捕获异常并输出日志
        console.log('删除角色异常:', error);
        ctx.body = utils.fail('删除角色异常');
    }
});

/**
 * 设置角色权限接口
 * POST /api/roles/permission
 * @param {string} _id - 角色ID
 * @param {Object} permissionList - 权限列表对象
 * @returns {Object} - 设置结果
 */
router.post('/permission', async (ctx) => {
    var { _id, ...updateParams } = ctx.request.body;
    const authorization = ctx.request.header.authorization || ctx.request.headers.authorization;
    const operator = utils.decoded(authorization);

    if (!operator || !isCompanyPermissionAdmin(operator)) {
        ctx.body = utils.fail('仅青阳子可配置角色模板权限');
        return;
    }

    try {
        await Role.findByIdAndUpdate(_id, updateParams);
        ctx.body = utils.success('设置成功');
    } catch (error) {
        console.log('设置角色权限异常:', error);
        ctx.body = utils.fail('设置角色权限异常');
    }
});

// 导出路由模块
module.exports = router;