/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

import { HttpsProxyAgent } from 'https-proxy-agent';
import { NextRequest, NextResponse } from 'next/server';
import nodeFetch from 'node-fetch';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getNextApiKey } from '@/lib/tmdb.client';

export const runtime = 'nodejs';

/**
 * GET /api/tmdb/episodes?id=xxx&season=xxx
 * 获取电视剧季度的集数详情（带图片）
 */
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const season = searchParams.get('season');

    if (!id || !season) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const config = await getConfig();
    const tmdbApiKey = config.SiteConfig.TMDBApiKey;
    const tmdbProxy = config.SiteConfig.TMDBProxy;
    const tmdbReverseProxy = config.SiteConfig.TMDBReverseProxy;

    if (!tmdbApiKey) {
      return NextResponse.json({ error: 'TMDB API Key 未配置' }, { status: 400 });
    }

    const actualKey = getNextApiKey(tmdbApiKey);
    if (!actualKey) {
      return NextResponse.json({ error: 'TMDB API Key 无效' }, { status: 400 });
    }

    // 使用反代代理或默认 Base URL
    const baseUrl = tmdbReverseProxy || 'https://api.themoviedb.org';
    const url = `${baseUrl}/3/tv/${id}/season/${season}?api_key=${actualKey}&language=zh-CN`;

    const fetchOptions: any = tmdbProxy
      ? {
          agent: new HttpsProxyAgent(tmdbProxy, {
            timeout: 30000,
            keepAlive: false,
          }),
          signal: AbortSignal.timeout(30000),
        }
      : {
          signal: AbortSignal.timeout(15000),
        };

    const response = await nodeFetch(url, fetchOptions);

    if (!response.ok) {
      return NextResponse.json({ error: '获取失败' }, { status: response.status });
    }

    const data: any = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('获取集数详情失败:', error);
    return NextResponse.json(
      { error: '获取失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
