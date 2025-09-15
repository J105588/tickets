/**
 * 時間帯設定データ（フロントエンド用）
 * 実際の公演スケジュールに基づく時間帯設定
 */

const TIMESLOT_SCHEDULES = {
  "1": {
    "1": { 
      "A": "09:15-10:15",  // 第一公演
      "B": "11:15-12:15",  // 第二公演
      "C": "13:15-14:15"   // 第三公演
    },
    "2": { 
      "A": "09:35-10:35",  // 第一公演
      "B": "11:35-12:35",  // 第二公演
      "C": "13:35-14:35"   // 第三公演
    }
  },
  "2": {
    "1": { 
      "A": "10:25-11:25",  // 第一公演
      "B": "12:25-13:25",  // 第二公演
      "C": "14:25-15:25"   // 第三公演
    },
    "2": { 
      "A": "09:15-10:15",  // 第一公演
      "B": "11:15-12:15",  // 第二公演
      "C": "13:15-14:15"   // 第三公演
    }
  },
  "3": {
    "1": { 
      "A": "09:25-10:25",  // 第一公演
      "B": "11:35-12:35",  // 第二公演
      "C": "14:55-15:55"   // 第三公演
    },
    "2": { 
      "A": "09:25-10:25",  // 第一公演
      "B": "11:25-12:25",  // 第二公演
      "C": "13:25-14:25"   // 第三公演
    }
  },
  "4": {
    "1": { 
      "A": "09:15-10:15",  // 第一公演
      "B": "11:15-12:15",  // 第二公演
      "C": "13:35-14:35"   // 第三公演
    },
    "2": { 
      "A": "09:15-10:15",  // 第一公演
      "B": "11:15-12:15",  // 第二公演
      "C": "13:15-14:15"   // 第三公演
    }
  },
  "5": {
    "1": { 
      "A": "09:35-10:35",  // 第一公演
      "B": "11:35-12:35",  // 第二公演
      "C": "14:45-15:45"   // 第三公演
    },
    "2": { 
      "A": "09:35-10:35",  // 第一公演
      "B": "11:35-12:35",  // 第二公演
      "C": "13:35-14:35"   // 第三公演
    }
  },
  "6": {
    "1": { 
      "A": "09:25-10:25",  // 第一公演
      "B": "11:25-12:25",  // 第二公演
      "C": "13:45-14:45"   // 第三公演
    },
    "2": { 
      "A": "09:25-10:25",  // 第一公演
      "B": "11:25-12:25",  // 第二公演
      "C": "13:55-14:55"   // 第三公演
    }
  },
  "7": {
    "1": { 
      "A": "10:25-11:25",  // 第一公演
      "B": "12:25-13:25",  // 第二公演
      "C": "14:25-15:25"   // 第三公演
    },
    "2": { 
      "A": "09:15-10:15",  // 第一公演
      "B": "11:15-12:15",  // 第二公演
      "C": "13:25-14:25"   // 第三公演
    }
  },
  "8": {
    "1": { 
      "A": "09:15-10:15",  // 第一公演
      "B": "11:25-12:25",  // 第二公演
      "C": "13:35-14:35"   // 第三公演
    },
    "2": { 
      "A": "09:35-10:35",  // 第一公演
      "B": "11:35-12:35",  // 第二公演
      "C": "13:35-14:35"   // 第三公演
    }
  },
  "見本演劇": {
    "1": { 
      "A": "14:00-14:20", 
      "B": "15:30-15:50" 
    }
  }
};

function getTimeslotTime(group, day, timeslot) {
  try {
    return TIMESLOT_SCHEDULES[group.toString()][day.toString()][timeslot];
  } catch (e) {
    console.log(`Time not found for ${group}-${day}-${timeslot}`);
    return timeslot;
  }
}

function getTimeslotDisplayName(group, day, timeslot) {
  const time = getTimeslotTime(group, day, timeslot);
  return `${timeslot}時間帯 (${time})`;
}

// ★★★ 修正点 ★★★
// この関数を他のファイルから import できるように、exportキーワードを追加します。
export function getAllTimeslotsForGroup(group) {
  const groupSchedule = TIMESLOT_SCHEDULES[group.toString()];
  if (!groupSchedule) return [];

  const results = [];
  for (const day in groupSchedule) {
    const daySchedule = groupSchedule[day];
    for (const timeslot in daySchedule) {
      const time = daySchedule[timeslot];
      results.push({
        day: day,
        timeslot: timeslot,
        time: time,
        displayName: `${timeslot}時間帯 (${time})`
      });
    }
  }
  return results;
}