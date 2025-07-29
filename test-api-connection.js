#!/usr/bin/env node

const https = require('https');
const http = require('http');

// 测试配置
const API_ENDPOINT = 'https://omnivore-api.historyai.top/api/graphql';
const API_KEY = process.env.OMNIVORE_API_KEY || 'your-api-key-here';

console.log('🔍 Omnivore API 连接诊断工具\n');

// 测试1: 基本连接测试
async function testBasicConnection() {
  console.log('1️⃣ 测试基本连接...');
  
  return new Promise((resolve) => {
    const url = new URL(API_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: 'GET',
      timeout: 10000,
    }, (res) => {
      console.log(`   ✅ 连接成功 - 状态码: ${res.statusCode}`);
      console.log(`   📡 服务器: ${res.headers.server || 'Unknown'}`);
      console.log(`   🔒 协议: ${url.protocol}`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ 连接失败: ${err.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('   ⏰ 连接超时');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// 测试2: GraphQL端点测试
async function testGraphQLEndpoint() {
  console.log('\n2️⃣ 测试GraphQL端点...');
  
  const testQuery = {
    query: `
      query {
        __typename
      }
    `
  };
  
  return new Promise((resolve) => {
    const url = new URL(API_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify(testQuery);
    
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.data && response.data.__typename === 'Query') {
            console.log('   ✅ GraphQL端点正常工作');
            console.log(`   📊 响应: ${JSON.stringify(response, null, 2)}`);
            resolve(true);
          } else {
            console.log('   ⚠️  GraphQL响应格式异常');
            console.log(`   📊 响应: ${data}`);
            resolve(false);
          }
        } catch (err) {
          console.log(`   ❌ JSON解析失败: ${err.message}`);
          console.log(`   📊 原始响应: ${data}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ 请求失败: ${err.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('   ⏰ 请求超时');
      req.destroy();
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

// 测试3: 认证测试（需要API密钥）
async function testAuthentication() {
  console.log('\n3️⃣ 测试API认证...');
  
  if (!API_KEY || API_KEY === 'your-api-key-here') {
    console.log('   ⚠️  未提供API密钥，跳过认证测试');
    console.log('   💡 设置环境变量: export OMNIVORE_API_KEY="your-api-key"');
    return true;
  }
  
  const testQuery = {
    query: `
      query {
        me {
          id
          name
        }
      }
    `
  };
  
  return new Promise((resolve) => {
    const url = new URL(API_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;
    
    const postData = JSON.stringify(testQuery);
    
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': API_KEY,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.data && response.data.me) {
            console.log('   ✅ API认证成功');
            console.log(`   👤 用户: ${response.data.me.name} (ID: ${response.data.me.id})`);
            resolve(true);
          } else if (response.errors) {
            console.log('   ❌ API认证失败');
            console.log(`   🚨 错误: ${JSON.stringify(response.errors, null, 2)}`);
            resolve(false);
          } else {
            console.log('   ⚠️  未知响应格式');
            console.log(`   📊 响应: ${data}`);
            resolve(false);
          }
        } catch (err) {
          console.log(`   ❌ JSON解析失败: ${err.message}`);
          console.log(`   📊 原始响应: ${data}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ 请求失败: ${err.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('   ⏰ 请求超时');
      req.destroy();
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

// 主函数
async function runDiagnostics() {
  console.log(`🌐 测试端点: ${API_ENDPOINT}\n`);
  
  const results = {
    basic: await testBasicConnection(),
    graphql: await testGraphQLEndpoint(),
    auth: await testAuthentication(),
  };
  
  console.log('\n📋 诊断结果:');
  console.log(`   基本连接: ${results.basic ? '✅ 正常' : '❌ 失败'}`);
  console.log(`   GraphQL端点: ${results.graphql ? '✅ 正常' : '❌ 失败'}`);
  console.log(`   API认证: ${results.auth ? '✅ 正常' : '❌ 失败'}`);
  
  console.log('\n💡 建议:');
  if (!results.basic) {
    console.log('   - 检查网络连接');
    console.log('   - 验证端点URL是否正确');
  }
  if (!results.graphql) {
    console.log('   - 检查服务器是否正常运行');
    console.log('   - 验证GraphQL端点配置');
  }
  if (!results.auth) {
    console.log('   - 检查API密钥是否正确');
    console.log('   - 验证API密钥权限');
  }
  
  if (results.basic && results.graphql && results.auth) {
    console.log('   🎉 所有测试通过！端点配置正确。');
  } else {
    console.log('   🔧 请根据上述建议修复问题。');
  }
}

// 运行诊断
runDiagnostics().catch(console.error); 