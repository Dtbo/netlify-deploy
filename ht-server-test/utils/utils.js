/**
 * 工具函数模块
 * 提供通用的工具方法
 * @author Lee
 */

// 引入 jsonwebtoken 模块
var jwt = require('jsonwebtoken');

/**
 * 状态码常量定义
 * @type {Object}
 * @property {number} SUCCESS - 成功状态码
 * @property {number} PARAM_ERROR - 参数错误状态码
 * @property {number} USER_ACCOUNT_ERROR - 账号或密码错误状态码
 * @property {number} USER_LOGIN_ERROR - 用户未登录状态码
 * @property {number} BUSINESS_ERROR - 业务请求失败状态码
 * @property {number} AUTH_ERROR - 认证失败或 Token 过期状态码
 */
let CODE = {
    SUCCESS: 200,              // 成功
    PARAM_ERROR: 10001,        // 参数错误
    USER_ACCOUNT_ERROR: 20001, // 账号或密码错误
    USER_LOGIN_ERROR: 30001,   // 用户未登录
    BUSINESS_ERROR: 40001,     // 业务请求失败（修改为 40001，避免与 Token 过期混淆）
    NEED_CREATE_USER: 40002,   // 用户不存在，需先在用户管理创建
    AUTH_ERROR: 50001          // 认证失败或 TOKEN 过期
};

/**
 * 分页工具函数
 * @param {Object} params - 分页参数
 * @param {number} params.currentPage - 当前页码
 * @param {number} params.pageSize - 每页条数
 * @returns {Object} - 包含分页信息和跳过条数的对象
 */
function pager({ currentPage, pageSize }) {
    // 将字符串转换为数字
    const currentpage = currentPage * 1;
    const pagesize = pageSize * 1;

    // 计算跳过的条数
    const skipIndex = (currentpage - 1) * pagesize;

    return {
        page: { currentpage, pagesize },
        skipIndex
    };
}

/**
 * 将扁平菜单数组转换为树形结构（非递归方式）
 * @param {Array} data - 扁平的菜单数据数组
 * @returns {Array} - 树形结构的菜单数组
 */
function TreeMenuList(data) {
    // 用于存储最终的树形结果
    let result = [];

    // 用于存储菜单的映射关系（ID -> 菜单对象）
    let map = {};

    // 首先建立映射关系
    data.forEach(item => {
        map[item._id] = item;
    });

    // 遍历数据，构建树形结构
    data.forEach(item => {
        // 获取父级菜单ID（取最后一个父级ID）
        let parentId = item.parentId.slice().pop();

        // 查找父级菜单
        let parent = map[parentId];

        if (parent) {
            // 如果有父级菜单，将当前菜单添加到父级的 children 中
            (parent.children || (parent.children = [])).push(item);

            // 如果父级没有组件（说明是目录类型），添加到 action 中
            if (parent.component == '') {
                (parent.action || (parent.action = [])).push(item);
            }
        } else {
            // 如果没有父级菜单，作为顶级菜单添加到结果中
            result.push(item);
        }
    });

    return result;
}

/**
 * 成功响应函数
 * @param {any} data - 返回的数据
 * @param {string} msg - 返回的消息
 * @param {number} code - 状态码
 * @returns {Object} - 统一格式的成功响应对象
 */
function success(data = "", msg = "ok", code = CODE.SUCCESS) {
    return {
        data,
        msg,
        code
    };
}

/**
 * 失败响应函数
 * @param {any} data - 返回的数据
 * @param {string} msg - 返回的消息
 * @param {number} code - 状态码
 * @returns {Object} - 统一格式的失败响应对象
 */
function fail(data = "", msg = "fail", code = CODE.BUSINESS_ERROR) {
    return {
        data,
        msg,
        code
    };
}

/**
 * 解析 JWT Token
 * @param {string} Authorization - 请求头中的 Authorization 字段
 * @returns {Object|null} - 解析后的用户信息，失败返回 null
 */
function decoded(Authorization) {
    if (Authorization) {
        // 从 Authorization 头中提取 Token（格式：Bearer xxx）
        let token = Authorization.split(' ')[1];

        try {
            // 验证并解析 Token
            return jwt.verify(token, 'lee');
        } catch (error) {
            // Token 无效或过期
            return null;
        }
    }

    return null;
}

/**
 * 时间格式化函数
 * @param {Date} date - 日期对象
 * @param {string} rule - 格式化规则（默认：yyyy-MM-dd hh:mm:ss）
 * @returns {string} - 格式化后的日期字符串
 */
function formateDate(date, rule) {
    // 默认格式化规则
    let fmt = rule || 'yyyy-MM-dd hh:mm:ss';

    // 替换年份
    // 检查格式字符串中是否包含 y 字符（一个或多个）
    if (/(y+)/.test(fmt)) {
        // 提取匹配到的 y 字符串（如 "yyyy" 或 "yy"）
        const yearMatch = fmt.match(/(y+)/);
        if (yearMatch) {
            // date.getFullYear()获取当前年份（如 2025）
            fmt = fmt.replace(yearMatch[0], date.getFullYear());
        }
    }

    // 定义日期时间各部分的获取方法
    const o = {
        'M+': date.getMonth() + 1,    // 月份
        'd+': date.getDate(),         // 日期
        'h+': date.getHours(),        // 小时
        'm+': date.getMinutes(),      // 分钟
        's+': date.getSeconds()       // 秒
    };

    // 遍历替换各部分（月份、日期、小时、分钟、秒）
    for (let k in o) {
        // 动态创建正则表达式，用于匹配占位符（如 'MM', 'dd', 'hh' 等）
        if (new RegExp(`(${k})`).test(fmt)) {
            const val = o[k] + '';  // 将数字转为字符串
            const match = fmt.match(new RegExp(`(${k})`));
            if (match) {
                const placeholder = match[0];  // 匹配到的占位符（如 'MM'）
                // 使用 padStart 进行补零：确保字符串长度等于占位符长度，不足前面补零
                // 例如：val='9', placeholder='MM' → '09'
                //       val='12', placeholder='MM' → '12'
                fmt = fmt.replace(placeholder, val.padStart(placeholder.length, '0'));
            }
        }
    }

    return fmt;
}

// 导出工具函数
module.exports = {
    CODE,
    // 分页工具函数
    pager,
    // 树形菜单工具函数
    TreeMenuList,
    // 成功响应函数
    success,
    // 业务错误响应函数
    fail,
    // 解析 JWT Token 函数
    decoded,
    // 时间格式化函数
    formateDate
};