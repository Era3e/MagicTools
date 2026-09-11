---
"@mt/db": patch
"@mt/config": patch
"@mt/model-client": patch
"@mt/types": patch
"@mt/ui": patch
"@mt/utils": patch
---

补齐独立生产镜像所需的公共包文件声明，增加数据库就绪检查并修复数据库断连导致进程退出的问题。应用镜像携带生产依赖、迁移及必要资源，使用真实容器回归和固定digest制品清单验证交付。
