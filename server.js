import koa from 'koa'
import Http from 'http'
import { fileURLToPath } from 'url';
import { Server } from 'socket.io'
import chokidar from 'chokidar'
import fs, { readFileSync, statSync,accessSync } from 'fs'
import { resolve } from 'path';
import { createRequire } from 'module';

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
                /*
                    App.vue

                    /App.vue
                    ./App.vue

                    ../App.vue
                    ./../App.vue
                    ../App.vue
                    /../App.vue
                    ../../App.vue
                 */
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
                        returnImport = s1.replace(staticRoot, '@module')
                    } else if (isOnlyLetter.test(s1)) {
                        // returnImport = ` from '/@module/${s1}'`
                        returnImport = `/@module/${s1}`
                    } else {
                        //其他点情况 都报错
                        console.log('\x1b[41;30m 2 Error \x1b[41;37m not found \x1b[40;33m ' + s0 + ',' + s1 + ' \x1b[0m')
                    }
                }
            }
            //修改的时候 直接 输出
            if (!confUrl.getUrl(returnImport)) {
                confUrl.setUrl(returnImport)
            }
            return ` from '${returnImport}'`
        } catch (e) {
            //不要打印错误
        }
    })
}
//包一下
function urlCache() {
    let cached = {}
    return {
        setUrl: function (url) {
            let init = url
            //后面可以搞个单独的文件 这个文件里面的都是 .vue
            if (url !== '/' && url !== '/src/main.ts') {
                //里面有@module
                if (new RegExp(isOnlyModel).test(url)) {
                    url = url.replace(isOnlyModel, '/')
                }
                //是否包含后缀名 文件名不包含 .
                let arr = url.split('.')
                //有 . 就认为是有后缀名的
                if (arr.length === 1) {
                    /*
                        fs.stat 异步
                        fs.stat(src + url,(err,data)=>{
                            //如果是文件夹
                            if( data && data.isDirectory() && !data.isFile() ){
                                //直接匹配 index.js  或者 index.vue
                                isExists( url,'/index' )
                            }else{
                                isExists( url )
                            }
                        })
                    */
                    let file
                    try {
                        file = '/index'
                        //文件夹
                        statSync(src + url)
                        isExists(url, file)
                    } catch (e) {
                        file = ''
                        //非文件夹
                        isExists(url, file)
                    }
                    //如果object长度为
                    switch (Object.keys(pathObject[url]).length) {
                        case 2:
                            url = pathObject[url]['.js']
                            break
                        case 1:
                            url = pathObject[url][Object.keys(pathObject[url])[0]]
                            break
                        // case 0:
                        //     console.log('\x1b[41;30m 3 Error \x1b[41;37m not found \x1b[40;33m ' + url + file + '.js 或 ' + url + file + '.vue \x1b[0m')
                        //     break
                    }
                }
                url = '/' + staticRoot + url
            }
            cached[init] = url


            //检测文件是否存在
            function isExists(url, file) {
                let exists = ['.ts', '.js', '.vue']
                pathObject[url] = Object.create({})
                // pathObject[url] = Object.create(null)
                // pathObject[url] = []
                //感觉像是数组方便 但是 有个问题 当key=0 没有时，key=1 长度有，数组长度为2
                exists.forEach(ext => {
                    try {
                        accessSync(src + url + file + ext, fs.constants.F_OK)
                        // pathObject[url].push(url + index + ext)
                        pathObject[url][ext] = url + file + ext
                    } catch (err) {
                        // pathObject[url][ext] = false
                    }
                })
            }
        },
        getUrl: function (url) {
            return url
                ? cached[url] ? cached[url] : ''
                : cached
        }
    }
}


//缓存下
const confUrl = urlCache()

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
        let paths = resolve(__dirname, url.replace('@module', 'node_modules').slice(1))
        //找到node_modules 里面的 package.json
        // 这个可以再改成其他的
        let packAge = require(paths + '/package.json').module //.main
        //拿到里面的内容
        let content = readFileSync(paths + '/' + packAge, 'utf-8')
        ctx.type = 'application/javascript'
        ctx.body = writeImport(content)
    } else if (url.indexOf('.vue') > -1) {
        //获取路径
        let p = resolve(__dirname, url.replace('@module', 'src'))
        // 文件内容
        let content = readFileSync(resolve(__dirname, p.slice(1)), "utf-8")

        //写入文件
        // 将原文件处理成字符串
        ctx.type = 'application/javascript'
        ctx.body = `
const template =
\`${content}\`
export default{
    template
}
        `
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
watcher.on('change', (path) => {
    console.log('change->', path)
    // todo 可以通过获取文件内容对页面进行局部更新，现在是直接刷新页面
    ioSocket.emit('pageChange', {
        path: path,
        server: true,
        client: false
    })
}).on('add', (path) => {
    //添加的时候
    // console.log('add->',path)
    //
})