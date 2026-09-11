---
"@mt/db": patch
"@mt/config": patch
"@mt/model-client": patch
"@mt/types": patch
"@mt/ui": patch
"@mt/utils": patch
---

补齐独立生产镜像所需的公共包文件声明，增加数据库就绪检查并修复数据库断连导致进程退出的问题。应用镜像携带生产依赖、迁移及必要资源，使用真实容器回归和固定digest制品清单验证交付。

部署使用同一批已验收镜像、独立公开配置和已有秘密文件，记录成功/失败回执及可回退快照，提供本机和SSH入口。
