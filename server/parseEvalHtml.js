const { load } = require('cheerio');

/**
 * 신제품 평가 HTML 파일을 파싱하여 요약 데이터를 추출합니다.
 * @param {string} htmlContent - HTML 파일 내용
 * @returns {object|null} - 파싱된 요약 데이터 또는 null
 */
function parseEvalHtml(htmlContent) {
  try {
    const $ = load(htmlContent);

    // 평가 HTML 여부 확인 (score-val 요소가 있어야 함)
    if (!$('.score-val').length && !$('.conclusion-badge').length) {
      return null;
    }

    const result = {
      type: 'product_eval',
      title: $('title').text().replace('신제품 평가 요약 - ', '').trim(),
      headerText: $('.report-header h1').text().replace(/^📋\s*/, '').trim(),
      meta: $('.report-header p').text().trim(),
    };

    // 아이디어명, 제안자 추출 (1단계)
    const infoGrid1 = $('.card').eq(0);
    const labels = infoGrid1.find('.info-label');
    const values = infoGrid1.find('.info-value');
    labels.each((i, el) => {
      const label = $(el).text().trim();
      const value = $(values[i]).text().trim();
      if (label === '아이디어명') result.productName = value;
      if (label === '제안배경') result.background = value.substring(0, 100) + (value.length > 100 ? '...' : '');
      if (label === '제안자') result.proposer = value;
      if (label === '발굴경로') result.source = value;
    });

    // 2단계 기초 자료 요약
    const researchCard = $('.card').eq(1);
    const researchItems = {};
    researchCard.find('tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim();
        const val = $(cells[1]).text().trim();
        researchItems[key] = val.substring(0, 80) + (val.length > 80 ? '...' : '');
      }
    });
    result.research = researchItems;

    // 3단계 아이디어 평가 점수
    const evalCard = $('.card').eq(2);
    const evalHeaderText = evalCard.find('.card-header').text();
    const scoreMatch = evalHeaderText.match(/(\d+)\s*\/\s*(\d+)/);
    if (scoreMatch) {
      result.scoreTotal = parseInt(scoreMatch[1]);
      result.scoreMax = parseInt(scoreMatch[2]);
    }

    const evalItems = [];
    evalCard.find('tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const name = $(cells[0]).text().trim();
        const score = parseInt($(cells[1]).text().trim());
        evalItems.push({ name, score });
      }
    });
    result.evalItems = evalItems;

    // 4단계 Non-Commodity 평가
    const ncCard = $('.card').eq(3);
    const ncVerdict = ncCard.find('.verdict-badge').text().trim();
    result.nonCommodityVerdict = ncVerdict;

    const ncItems = [];
    ncCard.find('tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const name = $(cells[0]).text().trim();
        const verdict = $(cells[1]).text().trim();
        ncItems.push({ name, verdict });
      }
    });
    result.nonCommodityItems = ncItems;

    // 6단계 최종 결론
    result.totalScore = parseInt($('.score-val').first().text().trim()) || result.scoreTotal;
    result.conclusion = $('.conclusion-badge').first().text().trim();

    // 투표 결과
    const votes = {};
    $('.review-row').each((i, row) => {
      const label = $(row).find('span').first().text().trim();
      const val = $(row).find('.review-val').text().trim();
      votes[label] = val;
    });
    result.votes = votes;

    return result;
  } catch (e) {
    console.error('HTML 파싱 오류:', e);
    return null;
  }
}

module.exports = { parseEvalHtml };
