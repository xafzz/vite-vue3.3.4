import { readdirSync, statSync } from 'fs'
import { execa } from 'execa'
import chokidar from 'chokidar'

// 获取打包目录
const buildDirs = ['runtime-dom','runtime-core','compiler-core','compiler-dom','compiler-sfc','reactivity','shared']
// const dirs = readdirSync('packages').filter(dir => statSync(`packages/${dir}`).isDirectory())
const dirs = [
    'runtime-dom',
    'runtime-core',
    'shared'
]
// 对获取的目录进行打包
buildAll(dirs)

async function buildAll(dirs) {
    await runParallel(build,dirs).then(() => {
        console.log('ok')
    }).catch(e => {
        console.log(e);
    })
}

async function runParallel(fn,dirs) {

    let result = []
    if (Array.isArray(dirs)) {
        for (const dir of dirs) {
            result.push(fn(dir))
        }
    } else { 
        result.push(fn(dirs))
    }


    return Promise.all(result)
}

async function build(target) {
    // 并行打包
    await execa(
        'rollup',
        [
            '-c', //执行rollup的配置
            '--environment', //环境变量
            [
                `TARGET:${target}`
            ]
                .filter(Boolean)
                .join(',')
        ],
        { stdio: 'inherit' } // 输出子进程的日志
    )
}


const watcher = chokidar.watch('.', {
    ignored: ['dist','node_modules'],
    persistent: true
})

watcher.on('change', path => { 
    console.log(`changed-> ${path}`)
    if (path.indexOf('dist') === -1 && path.indexOf('packages') > -1) { 
        // const changeDir = path.split('/')
        // const dir = buildDirs.indexOf(changeDir[1]) > -1 ? changeDir[1] : buildDirs
        // console.log(changeDir,dir,[dir,...dirs])
        buildAll(dirs)
    }
    // src/main.ts src/xx.ts
    if (path.indexOf('dist') === -1 && path.indexOf('packages') === -1 && path.indexOf('src') > -1) { 
        buildAll(dirs)
    }
})