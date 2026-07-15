const fs = require('fs');
let content = fs.readFileSync('src/components/TimeSelect.tsx', 'utf8');

content = content.replace(
  `export function TimeSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {`,
  `export function TimeSelect({
  value,
  onChange,
  placeholder,
  minHour = 0,
  maxHour = 23,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minHour?: number;
  maxHour?: number;
}) {`
);

content = content.replace(
  `  for (let h = 0; h < 24; h++) {`,
  `  for (let h = minHour; h <= maxHour; h++) {`
);

fs.writeFileSync('src/components/TimeSelect.tsx', content);
console.log('Fixed TimeSelect.tsx');
