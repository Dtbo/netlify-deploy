/**
 * Koa 服务器主入口文件
 * 配置中间件、路由和错误处理
 * @author Lee
 */

// 1. 引入 Koa 框架 - 相当于买了个服务器的骨架
const Koa = require('koa');

// 2. 创建 Koa 应用实例 - 把骨架组装起来，形成一个完整的服务器
const app = new Koa();

// 3. 引入视图模板中间件 - 用于渲染 HTML 页面（虽然这个项目主要是 API）
const views = require('koa-views');

// 4. 引入 JSON 响应中间件 - 让返回的 JSON 数据更漂亮（格式化）
const json = require('koa-json');

// 5. 引入错误处理中间件 - 捕获服务器运行时的错误
const onerror = require('koa-onerror');

// 6. 引入请求体解析中间件 - 解析前端发来的 POST 数据（JSON、表单等）
const bodyparser = require('koa-bodyparser');

// 7. 引入日志中间件 - 记录每次请求的日志（请求方法、URL、时间等）
const logger = require('koa-logger');

// 8. 引入 JWT 中间件 - 用于 Token 认证（验证用户是否登录）
const jwt = require('koa-jwt');

// 9. 引入 CORS 跨域中间件 - 允许前端跨域请求（前后端分离必备）
const cors = require('@koa/cors');

// 10. 引入路由模块 - 用于管理 URL 路径和对应的处理函数
const router = require('koa-router')();

// 11. 引入工具函数模块 - 自己写的一些常用函数（如成功/失败响应、分页等）
const utils = require('./utils/utils.js');

// 12. 引入用户路由 - 用户相关的接口（登录、权限、用户管理等）
const users = require('./routes/users.js');

// 13. 引入角色路由 - 角色管理相关的接口
const roles = require('./routes/roles.js');

// 14. 引入部门路由 - 部门管理相关的接口
const depts = require('./routes/depts.js');

// 15. 引入菜单路由 - 菜单管理相关的接口
const menus = require('./routes/menus.js');

// 16. 引入休假路由 - 休假管理相关的接口
const leaves = require('./routes/leaves.js');

// 17. 引入图表路由 - 图表管理相关的接口
const echarts = require('./routes/echarts.js');

// 18. 引入上传路由 - 文件上传相关的接口
const upload = require('./routes/upload.js');

// 18. 配置错误处理中间件 - 告诉服务器遇到错误该怎么处理
onerror(app);

// 19. 连接数据库 - 启动时自动连接 MongoDB
require('./config/db');

// 20. 设置 session 密钥 - 用于加密 session（验证码等功能需要）
app.keys = ['some secret hurr'];

/**
 * Session 配置选项（大白话版）
 * key: Cookie 的名字，默认叫 koa.sess
 * maxAge: Cookie 过期时间，这里设置为 1 天（86400000 毫秒）
 * autoCommit: 自动把 Cookie 发给浏览器
 * overwrite: 允许覆盖同名的 Cookie
 * httpOnly: 只有服务器能访问 Cookie，前端 JS 不能读，更安全
 * signed: 给 Cookie 签名，防止被篡改
 * rolling: 每次请求都刷新 Cookie 过期时间
 * renew: 在 Cookie 快过期时自动刷新
 * sameSite: 设置为 'lax' 允许跨域发送 Cookie（开发环境使用）
 * secure: 开发环境设置为 false（HTTP），生产环境设置为 true（HTTPS）
 */
const CONFIG = {
    key: 'koa.sess',
    maxAge: 86400000,
    autoCommit: true,
    overwrite: true,
    httpOnly: true,
    signed: true,
    rolling: false,
    renew: false,
    sameSite: 'lax',   // 修改为 'lax' 以允许跨域 Cookie（开发环境）
    secure: false,     // 开发环境设置为 false（HTTP）
};

// 21. 引入 session 中间件 - 用于存储用户临时数据（如验证码）
const session = require('koa-session');

// 22. 启用 session 中间件 - 让服务器支持 session 功能
app.use(session(CONFIG, app));

// 23. 启用 CORS 跨域中间件 - 允许前端跨域访问（解决前后端分离的跨域问题）
app.use(cors({
    origin: 'http://localhost:8080',  // 允许的前端域名
    credentials: true,                 // 允许携带 credentials（Cookie）
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // 允许的 HTTP 方法
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],   // 允许的请求头
}));

// 24. 配置请求体解析中间件 - 支持解析 JSON、表单、文本类型的请求体
app.use(bodyparser({
    enableTypes: ['json', 'form', 'text']
}));

// 25. 启用 JSON 响应中间件 - 返回的 JSON 会自动格式化（好看）
app.use(json());

// 26. 启用日志中间件 - 在控制台打印请求日志（如 GET /api/users/login - 50ms）
app.use(logger());

// 27. 配置静态资源目录 - 设置 public 文件夹为静态资源目录（放图片、CSS等）
app.use(require('koa-static')(__dirname + '/public'));

// 28. 配置视图模板引擎 - 设置 views 文件夹为模板目录，使用 pug 模板引擎
app.use(views(__dirname + '/views', {
    extension: 'pug'
}));

/**
 * 自定义日志中间件（大白话版）
 * 作用：记录每个请求的响应时间
 * 流程：
 * 1. 请求进来时记录开始时间
 * 2. 执行后续的中间件（处理请求）
 * 3. 如果遇到 401 错误（Token 过期），返回友好提示
 * 4. 请求结束时计算响应时间并打印日志
 */
app.use(async (ctx, next) => {
    // 记录请求开始时间
    const start = new Date();

    // 执行后续中间件（处理完再回来）
    await next().catch((err) => {
        // 如果是 401 错误（Token 超时或无效）
        if (401 == err.status) {
            // 返回统一的失败响应
            ctx.body = utils.fail('Token 超时，请重新登录', 'fail', 401);
        }
    });

    // 计算响应时间（当前时间 - 开始时间）
    const ms = new Date() - start;

    // 打印日志：请求方法 + URL + 响应时间
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

// 29. 设置 API 路由前缀 - 所有接口都以 /api 开头（如 /api/users/login）
router.prefix('/api');

/**
 * JWT 认证中间件配置（大白话版）
 * 作用：保护接口，只有登录用户才能访问
 * 配置：
 * - secret: 'lee' 是签名密钥（和生成 Token 时用的一样）
 * - unless: 排除不需要认证的接口（登录和验证码）
 */
// 临时注释掉 JWT 中间件以解决服务器崩溃问题
// app.use(jwt({ secret: 'lee' }).unless({
//     path: [/^\/api\/users\/login/, /^\/api\/users\/captcha/]
// }));

// 30. 注册用户路由 - 把用户相关的接口挂载到主路由
router.use(users.routes(), users.allowedMethods());

// 31. 注册角色路由 - 把角色相关的接口挂载到主路由
router.use(roles.routes(), roles.allowedMethods());

// 32. 注册部门路由 - 把部门相关的接口挂载到主路由
router.use(depts.routes(), depts.allowedMethods());

// 33. 注册菜单路由 - 把菜单相关的接口挂载到主路由
router.use(menus.routes(), menus.allowedMethods());

// 34. 注册 echarts 路由 - 把图表相关的接口挂载到主路由 
router.use(echarts.routes(), echarts.allowedMethods());

// 35. 注册休假路由 - 把休假相关的接口挂载到主路由
router.use(leaves.routes(), leaves.allowedMethods());

// 36. 注册上传路由 - 把文件上传相关的接口挂载到主路由
router.use(upload.routes(), upload.allowedMethods());

// 36. 注册路由到应用 - 让服务器能处理这些路由  
app.use(router.routes(), router.allowedMethods());

/**
 * 全局错误处理（大白话版）
 * 作用：捕获服务器运行时的所有错误
 * 用法：服务器出错时会自动调用这个函数
 */
app.on('error', (err, ctx) => {
    // 打印错误信息到控制台
    console.error('server error', err, ctx);
});

// 31. 导出应用实例 - 让 bin/www 文件能启动这个服务器
module.exports = app;