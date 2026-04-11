# WBI 签名

## 原理

WBI (Web Bilibili Interface) 是 Bilibili API 的签名机制，通过对请求参数进行哈希和混淆达到防爬目的。

## 实现

### 关键文件

- `apps/api/src/utils/bilibili_utils.py` - WBI 工具函数

### 实现方式

```
1. 收集请求参数
2. 按 key 排序
3. 添加 wts 时间戳
4. 计算 aialgo 哈希
5. 生成签名
```

### 注意事项

- WBI 密钥会定期更新，需要从网页动态获取
- 当前实现参考 bilibili-api-common 项目

---

[返回上级](./README.md)