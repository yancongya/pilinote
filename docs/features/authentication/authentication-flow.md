# 认证流程

## 登录流程

1. 前端请求验证码
2. 用户扫码
3. 前端轮询获取登录结果
4. 后端获取 Cookies 并存储

## API

```
POST /api/auth/login
GET /api/auth/status
POST /api/auth/logout
```

---

[返回上级](./README.md)