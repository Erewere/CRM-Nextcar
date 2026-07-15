const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  `<TimeSelect
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="h:mm p.m."
                />`,
  `<TimeSelect
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="h:mm p.m."
                  minHour={businessHours.start}
                  maxHour={businessHours.end}
                />`
);

content = content.replace(
  `<TimeSelect
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="h:mm p.m."
                />`,
  `<TimeSelect
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="h:mm p.m."
                  minHour={businessHours.start}
                  maxHour={businessHours.end}
                />`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed time select in modal');
