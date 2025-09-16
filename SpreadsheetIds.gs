// ==== スプレッドシートID管理ファイル ====
// [修正済] キーの形式を 'group-day-timeslot' に変更
// [追加] 操作対象のシート名を定数として定義

// 操作対象のシート名（固定）
const TARGET_SEAT_SHEET_NAME = "Seats";  // リネーム: 値は"Seats"に統一
const LOG_SHEET_NAME = "ParentApplications";

// 座席管理用スプレッドシートID（本体IDのみ）
const SEAT_SHEET_IDS = {
  // 1組
  "1-1-A": "105mJ7NiqErTuw-HTZ4DEeFzuwPU_Q7jF6T8sDz6GMLg",  // 1日目 1回目
  "1-1-B": "106_lanDCnaHI8JKADXT4onsYvxInNbjG9EJ6mYmT8DU",  // 1日目 2回目
  "1-1-C": "11eOIN-z9Vmshq8SuX7WL21Is0Hmi9VY-0gaRU-BNBJM",  // 1日目 3回目
  "1-2-A": "12Hf6MMWSSXWwIkKcWYfKAeCUVIRWZjy6dc8fCf1vRls",  // 2日目 1回目
  "1-2-B": "12_DBdPD8BqEkPkSti_5VZeDTmy4Yu-vV50xMYZIV-tI",  // 2日目 2回目
  "1-2-C": "12_HRwCwXHYPxuVAwAX3OMoWlnDpZHLnD3FCdICeFfe4",  // 2日目 3回目
  
  // 2組
  "2-1-A": "1-lFkkIexOJaTATptpfNHaoMFCwID9TcR1ppsxZYLVZg",  // 1日目 1回目
  "2-1-B": "1wZAosN52tT6r-nGhmqef7D3hMr84G_DzcITRv8DWpXs",  // 1日目 2回目
  "2-1-C": "1ddtGS5mi8u5GlXXy05JNFQQhgCHt8OFec_PIbsl4nFg",  // 1日目 3回目
  "2-2-A": "1QD2uasnnw3A3vs-WzxkA52ELZp3pLFth7QiDO0A2cZ4",  // 2日目 1回目
  "2-2-B": "1NY9Fgo_2vdo7qcBAicL6PqGPpG7nJDFaCLQvG0ehg2Q",  // 2日目 2回目
  "2-2-C": "1fzx9zOtbH6PCrG0DCwN19WxUokBgjxiF1DNwYklrlQ0",  // 2日目 3回目
  
  // 3組
  "3-1-A": "134GGmFihAgrobpPooUUAVUFzbYtyvYnEnQr3udNWm-o",  // 1日目 1回目
  "3-1-B": "14CiceV1pQKoExRwbyeuUGu0-_MgxjhgN2teKW0vYuuY",  // 1日目 2回目
  "3-1-C": "14RyWL9obyOt-QTwh4wszfUj3s7TTTLBzYhTE7_I-cq0",  // 1日目 3回目
  "3-2-A": "14diDfaj_XL4GG_KoD66HUgoDG8bMfJQAvYzt0lyz4IY",  // 2日目 1回目
  "3-2-B": "14uPFpBjU4PfDtFuXXQj4EIgUOcxBtDELw0ou7F2CTLc",  // 2日目 2回目
  "3-2-C": "15AvQFV2gnRnaw3P2zsvngmxB0vJ2za6HJF8GyMaJhVE",  // 2日目 3回目
  
  // 4組
  "4-1-A": "15QtZAUX9kQNVloezB6aoP1Pmi7Z8Ux13yk9lf40Kvb0",  // 1日目 1回目
  "4-1-B": "10o4Iw0ylMbfSNXIfbW_O0AYDHLwvr6qUMsXDeseFV6E",  // 1日目 2回目
  "4-1-C": "149XTBHRYoXO_SXgA79t94OP-JFjJrI-eYdGmh9sKDKU",  // 1日目 3回目
  "4-2-A": "14FhIX82yhy9sJ0Ekz57GI7EF2KK3xRyV6AQRvE5gYJw",  // 2日目 1回目
  "4-2-B": "14ZGabVoY4SSFU_jCm7vR6Y8Ydfy5jJKTs32giNa9yQw",  // 2日目 2回目
  "4-2-C": "154oykIoJaNnqUnxmpQqnqBf_Tcg__O18bO3bbVJcGvQ",  // 2日目 3回目
  
  // 5組
  "5-1-A": "1wLASeHBC0Q4KnC_cyluKEu6wtCVBtPiNv7yiADPNloY",  // 1日目 1回目
  "5-1-B": "1LlfdQgwma0PKoP2l7R1sUd2PtjDs211UByloZJGzJPw",  // 1日目 2回目
  "5-1-C": "1ChzERkmw5dGfYcPxn1o8JTVTRJtnh5hWhYzKCUYbb2c",  // 1日目 3回目
  "5-2-A": "17scOod0T2fsrWzWlwWOBhcpX-NhSjOjrBN8ySJcFvJA",  // 2日目 1回目
  "5-2-B": "1eU0GVeRQoMd-PxrkalgW2VKY-jRZuVW_5rQt-KfjcgA",  // 2日目 2回目
  "5-2-C": "12PuN0RvjqHzupiqJ7peAeve-MU-DAXJmQfaE9imVowM",  // 2日目 3回目
  
  // 6組
  "6-1-A": "1fPDzspL690RblXyCICg96Pbz6ToqlW-uFDT-a-0I7nQ",  // 1日目 1回目
  "6-1-B": "1NO7Mj_H5293tTvE5rK_qwgpjDUW5i7LA6mjfJ_UrZDo",  // 1日目 2回目
  "6-1-C": "1qd24qbTgZcy4JL237wEl18h0OmvMUIwX6svsW1bnY5c",  // 1日目 3回目
  "6-2-A": "18YR-V7cz0UvSjw7HSPuLy6N3mcEpRKC-D6Ukpw4PAr4",  // 2日目 1回目
  "6-2-B": "1ScjH1DM1iYirzlpt07JpQ6aYbn2_NP3fzH0YCUmM1GM",  // 2日目 2回目
  "6-2-C": "1EaeYZNtN_21h6GmTSIOMdC6kv0GAGWfVPEovE5JSz84",  // 2日目 3回目
  
  // 7組
  "7-1-A": "1O0_nSRsD1e7dK2fPlVMshzB_OVlhN-stxQe3QAzF18w",  // 1日目 1回目
  "7-1-B": "1zMoucGkaxKpEzXALftskl-J6pgINLaVbuK9Uj6C_s2c",  // 1日目 2回目
  "7-1-C": "109tcX5PgGotZJQAuTJw9mCJM78WJMtVKXqSqslL2UH0",  // 1日目 3回目
  "7-2-A": "1ewqf50VtyqB1RkMC57eb3Ii8n-AIc5SoY58gZ7g6bwY",  // 2日目 1回目
  "7-2-B": "1wnR24GP_gyOZJ5xFHr-SpEIvCkwqD6-4sFnjtle8uWE",  // 2日目 2回目
  "7-2-C": "11HQ9MKGUBioVihHfdYBAIO98J6uRKEREkieGlaulY0A",  // 2日目 3回目
  
  // 8組
  "8-1-A": "1O9c_e67tnydLn3Q6z4hWUy_J_Eb5lwKYPeHz4BBtXTg",  // 1日目 1回目
  "8-1-B": "1SN_oeSkO-fTcxgx7tn-UdALhVi_BAGlH_oizrMz665M",  // 1日目 2回目
  "8-1-C": "1hr1wWDCRCF3kLPX0x4C8ITJZwdyme0WdBbiAMU4q98w",  // 1日目 3回目
  "8-2-A": "1FOHVv1jgcH2tH9_-i6iVJoQ-lujY2Q2c1AxXi1op-sI",  // 2日目 1回目
  "8-2-B": "10A2JRuvw-GX7jsqqL26eJHwYrYLHz3ZUk1xsFxysdZk",  // 2日目 2回目
  "8-2-C": "1020McijS7TnOrXS2Fmv3Js2blLR_HntXoqANg0Gi6sU",  // 2日目 3回目
  
  // 見本演劇
  "見本演劇-1-A": "1-lBQMuwjs0YnOpSt3nI8jQmHyNOqUNHiP3i2xXMcbmA",
  "見本演劇-1-B": "164pnCFDZKmrHlwU0J857NzxRHBeFgdKLzxCwM7DKZmo"
};

// ログ用スプレッドシートID (キーを座席シートと合わせる)
const LOG_SHEET_IDS = {
  "1-1-A": "YOUR_LOG_ID_HERE", "1-1-B": "YOUR_LOG_ID_HERE", // ... 各公演に対応するID
};

// スプレッドシートIDを取得する関数
function getSeatSheetId(group, day, timeslot) {
  const key = `${group}-${day}-${timeslot}`;
  let id = SEAT_SHEET_IDS[key];
  
  // デバッグ情報を出力
  console.log(`getSeatSheetId: 検索キー=${key}, 結果=${id || 'なし'}`);
  
  // IDが見つからない場合、テスト用の「見本演劇」のIDを使用
  if (!id || id === "YOUR_SHEET_ID_HERE") {
    if (group === '見本演劇') {
      // 見本演劇のIDを使用
      const testKey = `見本演劇-${day}-${timeslot}`;
      id = SEAT_SHEET_IDS[testKey];
      console.log(`テスト用キーで再検索: ${testKey}, 結果=${id || 'なし'}`);
      
      if (id && id !== "YOUR_SHEET_ID_HERE") {
        return id;
      }
    }
    
    // それでもIDが見つからない場合はエラー
    throw new Error(`座席シートIDが設定されていません: [組: ${group}, 日: ${day}, 時間帯: ${timeslot}]`);
  }
  return id;
}

function getLogSheetId(group, day, timeslot) {
  const key = `${group}-${day}-${timeslot}`;
  const id = LOG_SHEET_IDS[key];
  
  if (!id || id === "YOUR_LOG_ID_HERE") {
    console.log(`ログシートIDが設定されていません: [組: ${group}, 日: ${day}, 時間帯: ${timeslot}]`);
    return null;
  }
  return id;
}