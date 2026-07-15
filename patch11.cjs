const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  `          </div>
        </div>
      </div>
    </div>
  );
}`,
  `          </div>
        </div>
      </motion.div>
    </div>
  );
}`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed NewActivityModal closing tag');
