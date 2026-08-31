# 教师编制备考工作台

这是一个可静态部署的网站工作台，数据默认保存在浏览器 `localStorage`。

## 已实现

- 学习总览：累计作答、总体正确率、分类准确率、连续学习天数。
- 刷题：单选、多选、主观题背诵。
- 题库导入：支持 JSON / CSV / TXT，字段为 `question, options, answer, explanation, category, type, source`。
- 错题集：自动记录错题，支持导出 JSON / CSV。
- 记忆区：教师编制知识架构思维导图和背题卡。

## Cloud Studio 部署

1. 上传 `teacher-workbench` 文件夹。
2. 选择静态网站或 Nginx 静态服务。
3. 将站点根目录设为 `teacher-workbench`。
4. 入口文件为 `index.html`。

本地预览：

```bash
python -m http.server 5173
```

然后打开 `http://localhost:5173`。
