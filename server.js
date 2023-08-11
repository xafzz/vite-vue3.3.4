import koa from 'koa'
import Http from 'http'
import { fileURLToPath } from 'url';
import { Server } from 'socket.io'
import chokidar from 'chokidar'
import fs, { readFileSync, statSync } from 'fs'
import path, { resolve } from 'path';
import { createRequire } from 'module';
import { sfc } from '@vue/compiler-sfc';
import crypto from 'node:crypto'

//端口号
const port = 8888
const app = new koa()
//根目录
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const staticRoot = 'src'
const pathObject = Object.create(null)
//里面只有@module 而不是 @module/@/的时候
const isOnlyModel = '/@module/'
/**
 *  @/vue     ./vue/index.js
 *  @vue        ./vue/index.js
 *  ./vue       ./vue/index.js
 */
//有一些是从node_modules 里面来的 要转成 @module
const isFit = new RegExp('@')
//只有英文字母跟点 必须是开头
const isOnlyLetter = /^([a-zA-Z]+)(\.)?([a-zA-Z]+)?$/
//是否有2个点 必须是开头  ./../ | ../ | /../
const isDoubleSpot = /^(\.\/\.\.\/|\.\.\/|\/\.\.\/)/
//开头包含 ./ /
const isSlashSpot = /^(\.\/|\/)/

const require = createRequire(import.meta.url)

//处理路径
function writeImport(content, initUrl) {
    return content.replace(/ from ['|"]([^'"]+)['|"]/g, (s0, s1) => {
        try {
            let returnImport
            //有没有 @ ，有 @
            if (isFit.test(s1)) {
                //这个简单 将 @替换了
                // returnImport = ` from '${s1.replace(/^(\/ |\.\/)?@(\/)?/,'/@module/')}'`
                returnImport = s1.replace(/^(\/ |\.\/)?@(\/)?/, '/@module/@')
            } else {
                //App.vue
                // 包含 ../ ,有种特殊情况  目录里面点
                if (isDoubleSpot.test(s1)) {
                    //需要先把 ./  /去掉 ,只剩下 ../xx 或者 ../../xxx
                    let newS1 = s1.replace(isSlashSpot, '')
                    //根据 ../ 切割 数组
                    let newS1Arr = newS1.split('..\/')
                    //获取 ../ 个数 需要将路径进行拼接 这里以 src 当作根目录
                    let count = newS1.match(/\.\.\//g)
                    //将数组 去空 得到最终数组
                    // 源码里面用到了很多 不如实际情况自己用一次
                    newS1Arr = newS1Arr.filter(n => n)
                    //将当前路径 分成数组
                    let pathArr = initUrl.split('\/')
                    //去空一下 有可能 传过来的路径是 /xx 而不是 xx
                    pathArr = pathArr.filter(n => n)
                    if (pathArr.length > count.length) {
                        pathArr.splice(-count.length, count.length)
                        let newImport = pathArr.join('\/') + '/' + newS1Arr.join('\/')
                        // returnImport = ` from '${newImport.replace('src','/@module')}'`
                        returnImport = newImport.replace('src', '/@module')
                    } else {
                        console.log('\x1b[41;30m 1 Error \x1b[41;37m not found \x1b[40;33m ' + initUrl + s1 + ' \x1b[0m')
                    }
                } else {
                    //开头包含 ./ 或者 /
                    if (isSlashSpot.test(s1)) {
                        //这种情况 是当前路径下的地址 所以这个点 也要主要
                        //如果是 src 下面的 就是 直接 @module
                        //如果是子目录下面的 ./ 就需要包含当前的路径了
                        //不着急替换成最终的 先进行拼接
                        // s1 = s1.replace(isSlashSpot,'/@module/')
                        s1 = initUrl + s1.replace(isSlashSpot, '/')

                        // returnImport = ` from '${s1.replace(staticRoot,'@module')}'`
                        returnImport = s1
                    } else if (isOnlyLetter.test(s1)) {
                        // returnImport = ` from '/@module/${s1}'`
                        returnImport = `/@module/${s1}`
                    } else {
                        // 什么都没有的时候 import { LRUCache } from 'lru-cache'
                        returnImport = `/@module/${s1}`
                        //其他点情况 都报错
                        // console.warn('\x1b[41;30m 2 Waring \x1b[40;33m ' + s0 + ' \x1b[0m')
                    }
                }
            }

            return ` from '${returnImport}'`
        } catch (e) {
            //不要打印错误
        }
    })
}

function slash(path) {
    const isExtendedLengthPath = /^\\\\\?\\/.test(path);
    if (isExtendedLengthPath) {
        return path;
    }
    return path.replace(/\\/g, '/');
}

function getHash(text) {
    return crypto.createHash("sha256").update(text).digest("hex").substring(0, 8);
}

app.use(async (ctx, next) => {

    const { url } = ctx

    // 引入 index.html
    if (url === '/') {
        const content = readFileSync('./index.html', 'utf-8')
        //写入文件
        ctx.type = 'text/html'
        ctx.body = content
    } else if (url.endsWith('.ts') || url.endsWith('.js')) {
        // 路径
        const paths = resolve(__dirname, url.slice(1))
        // 获取ts内容
        const content = readFileSync(paths, 'utf-8')

        let newUrl
        try {
            statSync(paths)
            let initUrlArr = url.split('\/')
            initUrlArr.pop()
            newUrl = initUrlArr.join('\/')
        } catch (e) {
            newUrl = url
        }
        ctx.type = 'application/javascript'
        ctx.body = writeImport(content, newUrl)

    } else if (url.indexOf('@module/@') > -1) {

        if (url.endsWith('.map')) {
            // let content = readFileSync(paths, 'utf-8')
            const urlArray = url.split('\/')
            const dir = urlArray[urlArray.length - 1].split('.')
            urlArray.splice(-1, 0, `${dir[0]}/dist`)

            let paths = resolve(__dirname, urlArray.join('/').replace('@module', 'node_modules').slice(1))

            let content = readFileSync(paths, 'utf-8')
            ctx.type = 'application/javascript'
            ctx.body = writeImport(content)
        } else {
            let paths = resolve(__dirname, url.replace('@module', 'node_modules').slice(1))

            //找到node_modules 里面的 package.json
            // 这个可以再改成其他的
            let packAge = require(paths + '/package.json').module //.main
            //拿到里面的内容
            let content = readFileSync(paths + '/' + packAge, 'utf-8')
            ctx.type = 'application/javascript'
            ctx.body = writeImport(content)
        }

    } else if (url.indexOf('.vue') > -1) {
        //获取路径
        let p = resolve(__dirname, url.replace('@module', 'src'))
        // 文件内容
        let content = readFileSync(resolve(__dirname, p.slice(1)), "utf-8")

        const normalizedPath = slash(path.normalize(path.relative(process.cwd(), url)));

        const __hmrId = getHash(normalizedPath + content)
        const __scopeId = `data-v-${__hmrId}`
        const ast = sfc(content, {
            root: process.cwd(),
            filename: process.cwd() + resolve(__dirname, url),
            scopeId: __scopeId,
        })
        
        // const output = {
        //     scriptCode: ast.script,
        //     scriptSetupCode: ast.scriptSetup,
        //     templateCode: ast.code,
        //     stylesCode: ast.styles,
        //     customBlocksCode: ast.customBlocks
        // }

        //写入文件
        // 将原文件处理成字符串
        ctx.type = 'application/javascript'
        ctx.body = `${ast.code}
        
const __hmrId = '${getHash(normalizedPath + content)}'
const __scopeId = 'data-v-${__hmrId}'
        
export default /*#__PURE__*/ ${`{'render':_sfc_render,'__hmrId':__hmrId,'__scopeId':__scopeId}`}`
        // ctx.body = `export default ${JSON.stringify(content)}`
    } else if (url.indexOf('@module/') > -1) { //最后处理例： from 'lru-cache'

        if (url.endsWith('.map')) {

            let content = readFileSync(__dirname + resolve(__dirname, url.replace('@module', '')), 'utf-8')

            ctx.type = 'application/javascript'
            ctx.body = writeImport(content)
        } else {
            let paths = resolve(__dirname, url.replace('@module', 'node_modules')).slice(1)
            //找到node_modules 里面的 package.json
            // 这个可以再改成其他的
            let packAge = require(__dirname + paths + '/package.json').module //.main
            // ./dist dist
            if (packAge.indexOf('./dist') > -1) {
                packAge = packAge.replace('./dist', 'dist')
            }
            //拿到里面的内容
            let content = readFileSync(__dirname + paths + '/' + packAge, 'utf-8')
            // 如果开启了sourceMap 会在最下面加上地址

            if (/\/\/\# sourceMappingURL=/.test(content)) {
                const urlages = packAge.split('\/')
                urlages.pop()
                const p = paths + '/' + urlages.join('\/')

                content = content.replace('# sourceMappingURL=', `# sourceMappingURL=${p}/`)
            }

            ctx.type = 'application/javascript'
            ctx.body = content
        }
    }

    return next();   // 执行后代的代码
})


const httpServer = Http.createServer(app.callback())
const io = new Server(httpServer);

httpServer.listen(port, () => {
    console.log(`Listening...${port}`)
})

const watcher = chokidar.watch('.', {
    ignored: ['node_modules', '.idea', '.git', 'yarn-error.log', 'yarn.lock', '.gitignore', 'README.md', 'package.json'],
    persistent: true
})

let ioSocket;
watcher.on('ready', () => {
    //初始化 建立链接
    ioSocket = io.on('connection', function (socket) {
        //监听客户端 其实没啥用 完全可以注释掉
        socket.on('client', (data) => {
            if (data && data.client) {
                console.log('client is true')
            }
        })
        return socket
    });
})

// 防抖 timer
let timer = false
let time = true
watcher.on('change', async path => {
    // 接收到第一次 通知页面loading住
    if (path.indexOf('dist') > -1) {

        console.log('change->', path)
        // 第一次有变化 通知页面loading
        if (time) {
            ioSocket.emit('first', {
                path: path,
                server: true,
                client: false
            })
        }
        time = false

        clearTimeout(timer)
        timer = setTimeout(() => {
            // 重置回去
            time = true
            ioSocket.emit('pageChange', {
                path: path,
                server: true,
                client: false
            })
        }, 500);
    }
})
