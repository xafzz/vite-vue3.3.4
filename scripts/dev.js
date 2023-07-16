import { readdirSync, statSync } from 'fs'
import { execa } from 'execa'

// 获取打包目录
// const dirs = readdirSync('packages').filter(dir => statSync(`packages/${dir}`).isDirectory())
const dirs = [
    'reactivity',
    'shared'
]
// 对获取的目录进行打包
buildAll()

async function buildAll() {
    await runParallel(build).then(() => {
        console.log('ok')
    }).catch(e => {
        console.log(e);
    })
}

async function runParallel(fn) {

    let result = []

    for (const dir of dirs) {
        result.push(fn(dir))
    }

    return Promise.all(result)
}

async function build(target) {
    // 并行打包
    await execa(
        'rollup',
        [
            '-cw', //执行rollup的配置
            '--environment', //环境变量
            `TARGET:${target}`
        ],
        { stdio: 'inherit' } // 输出子进程的日志
    )
}
