const fs = require('fs');
const file = 'c:/Codes/DemoAITrainer/AI-T/frontend/app/rep/train/[scenarioId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');
let lines = content.split(/\r?\n/);

const startIndex = lines.findIndex(l => l.includes('return (') && lines[lines.indexOf(l)+1].includes('<div className="space-y-6">') && lines[lines.indexOf(l)+2].includes('{/* Current Situation */}'));

let endIndex = -1;
for (let i = startIndex + 1; i < lines.length; i++) {
  if (lines[i].includes('</div>') && lines[i+1] && lines[i+1].includes('</div>') && lines[i-1] && lines[i-1].includes('})()}')) {
    endIndex = i + 1;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `              return (
                <div className="space-y-6">
                  {/* Current Situation */}
                  {text && (
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                        Current Situation
                      </h4>
                      {renderList(text)}
                    </div>
                  )}

                  {/* Expect These Challenges */}
                  {(metadata?.objection_style || scenario.objection_style) && (
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"></span>
                        Expect These Challenges
                      </h4>
                      {renderList(metadata?.objection_style || scenario.objection_style)}
                    </div>
                  )}

                  {/* Must-ask questions */}
                  {rubricLines.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-green-700 mb-2">
                        ✓ Must-Ask Questions
                      </h4>
                      <ul className="space-y-1.5">
                        {rubricLines.map((q, i) => (
                          <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                            <span className="mt-0.5 text-green-500 shrink-0">›</span>{q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Your objective */}
                  {(scenario.conversation_expectations || metadata?.target_skills) && (
                    <div className="bg-[#EFF6FF] rounded-lg p-3 border border-blue-200">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700 mb-1">
                        Your Objective
                      </h4>
                      <p className="text-sm text-blue-900 font-medium">{scenario.conversation_expectations || \`Focus on: \${metadata?.target_skills}\`}</p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>`;
  
  lines.splice(startIndex, endIndex - startIndex + 1, ...replacement.split('\n'));
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Fixed file via node script');
} else {
  console.log('Could not find block indices', startIndex, endIndex);
}
