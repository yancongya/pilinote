# 用户认证方案

## 认证方式
1. **扫码登录** (推荐)
   - API: `/x/passport-login/web/qrcode/generate`
   - API: `/x/passport-login/web/qrcode/poll`
   - 有效期: 180s

2. **SESSDATA** (快速开发)
   - 手动输入cookie
   - 自动提取: SESSDATA, bili_jct, buvid3

3. **密码登录** (完整方案)
   - API: `/x/passport-login/web/key`
   - RSA加密
   - API: `/x/passport-login/web/login`
   - 支持极验验证码

## Cookie管理
- 持久化存储
- 支持多账号
- 自动刷新token

## 参考实现
- `reference/pilipala/lib/http/login.dart`
- `reference/pilipala/lib/utils/login.dart`
- `reference/pilipala/lib/pages/login/controller.dart`