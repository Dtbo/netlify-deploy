/**
 * Token 工具模块
 * 负责生成和管理 JWT Token
 * @author Lee
 */

// 引入 jsonwebtoken 库
const jwt = require('jsonwebtoken');

// 密钥，用于签名和验证 Token
const secret = 'lee';

// AccessToken 过期时间：10小时
const accessTokenTime = '10h';

// RefreshToken 过期时间：20小时
const refreshTokenTime = '20h';

/**
 * 生成 AccessToken
 * @param {Object} payload - 用户信息负载
 * @returns {string} - 生成的 AccessToken
 */
const setAccessToken = (payload) => {
    return jwt.sign(payload, secret, { expiresIn: accessTokenTime });
};

/**
 * 生成 RefreshToken
 * @param {Object} payload - 用户信息负载
 * @returns {string} - 生成的 RefreshToken
 */
const setRefreshToken = (payload) => {
    return jwt.sign(payload, secret, { expiresIn: refreshTokenTime });
};

// 导出模块
module.exports = {
    secret,          // 密钥
    setAccessToken,  // 生成 AccessToken 方法
    setRefreshToken  // 生成 RefreshToken 方法
};