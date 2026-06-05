/**
 * Excel 导出工具模块
 * 用于将数据导出为 Excel 文件
 * @author Lee
 */

// 引入 node-xlsx 模块
const xlsx = require("node-xlsx");

/**
 * 导出 Excel 文件
 * @param {Array} data - 需要导出的数据（格式：[{字段1:值1, 字段2:值2}, ...]）
 * @param {Object} options - Excel 文件样式配置（可选）
 * @returns {Buffer} - Excel 文件的 Buffer 对象
 */
module.exports = {
        exportExcel(data, options) {
        const xlsxObj = [{
            name: '用户数据',
            data: []
        }];

        if (!data || !data.length) {
            xlsxObj[0].data.push(['用户ID', '用户名称', '邮箱', '手机号', '岗位', '角色', '状态', '注册时间', '最后登录时间']);
        } else {
            data.forEach((item, idx) => {
                if (idx === 0) {
                    xlsxObj[0].data.push(Object.keys(item));
                }
                xlsxObj[0].data.push(Object.values(item));
            });
        }

        const colOptions = options || {
            '!cols': [
                { wch: 12 },
                { wch: 14 },
                { wch: 24 },
                { wch: 14 },
                { wch: 14 },
                { wch: 10 },
                { wch: 10 },
                { wch: 20 },
                { wch: 20 }
            ]
        };

        return xlsx.build(xlsxObj, colOptions);
    }
};