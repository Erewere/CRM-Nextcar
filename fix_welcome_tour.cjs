const fs = require('fs');

let content = fs.readFileSync('src/components/WelcomeTour.tsx', 'utf8');

content = content.replace(
  "const isNewUser = userData?.createdAt ? (new Date().getTime() - new Date(userData.createdAt).getTime() < 1000 * 60 * 60 * 24 * 7) : false;",
  `
    let isNewUser = false;
    if (userData?.createdAt) {
      try {
        let createdDate;
        if (typeof userData.createdAt === 'string') {
          createdDate = new Date(userData.createdAt);
        } else if (typeof userData.createdAt === 'object' && 'toDate' in userData.createdAt) {
          // @ts-ignore
          createdDate = userData.createdAt.toDate();
        } else if (typeof userData.createdAt === 'object' && 'seconds' in userData.createdAt) {
           // @ts-ignore
           createdDate = new Date(userData.createdAt.seconds * 1000);
        } else {
          createdDate = new Date(userData.createdAt);
        }
        
        isNewUser = (new Date().getTime() - createdDate.getTime()) < 1000 * 60 * 60 * 24 * 7;
      } catch (e) {
        console.error("Error parsing createdAt", e);
        isNewUser = false; // default to false if error
      }
    }
  `
);

fs.writeFileSync('src/components/WelcomeTour.tsx', content, 'utf8');
