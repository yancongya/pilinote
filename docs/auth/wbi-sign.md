# WBI 签名

---
关联文档:
  - login-flow.md       # 登录流程
  - cookies.md         # Cookie 管理
  - database/models.md  # User 模型
涉及文件:
  - apps/api/src/utils/wbi_signature.py
  - apps/api/src/utils/crypto.py
  - apps/api/src/services/bilibili.py
依赖服务:
  - BilibiliService
---

## 原理

WBI (Web Bilibili Interface) 是 Bilibili API 的签名机制，通过对请求参数进行哈希和混淆达到防爬目的。

## 实现

### 关键文件

- `apps/api/src/utils/wbi_signature.py` - WBI 签名实现
- `apps/api/src/utils/crypto.py` - 通用签名（md5_sign）

### 实现方式

```
1. 收集请求参数
2. 获取 WBI 图片（img_url, sub_url）
3. 计算混合密钥（calculate_mixin_key）
4. 添加 wts 时间戳
5. 计算 wbi_sign 哈希
6. 生成签名参数 w_rid
```

### 核心函数

```python
# wbi_signature.py

# 1. 混合密钥计算
def calculate_mixin_key(img_key: str, sub_key: str) -> str:
    # 使用 MIXIN_KEY_ENC_TAB 数组重新排列
    mixed_key = "".join((img_key + sub_key)[i] for i in MIXIN_KEY_ENC_TAB)
    return mixed_key[:32]

# 2. WBI 签名计算
def calculate_wbi_sign(params: Dict, wbi_img: Dict) -> Dict:
    # 获取 WebGL 指纹
    # 排序参数
    # 计算签名
    # 返回带 w_rid 的参数
```

### WBI 图片获取

```
1. 从用户信息中获取 wbi_img（登录后）
2. 或从 API: https://api.bilibili.com/x/web-interface/nav 获取
3. 缓存图片用于后续签名
```

### 使用场景

- 收藏夹 API (`/api/favorites/*`)
- 稍后再看 API (`/api/watchlater`)
- 用户信息 API (`/api/auth/user-info`)

### 注意事项

- WBI 密钥会定期更新，需要从网页动态获取
- 实现参考 BiliTools 项目
- 使用 WebGL 指纹模拟

---

[返回上级](./README.md)