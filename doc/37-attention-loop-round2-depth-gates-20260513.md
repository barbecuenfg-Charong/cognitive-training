# 注意力与规划训练第二轮深化与第三轮门禁计划（2026-05-13）

## 1. 本轮目标

第二轮的核心不是继续加页面，而是把训练本体做深。

本轮验证的关键是两件事：

1. London Tower 的最优步数不能继续只依赖题库手写值，必须按当前规则实际求解或校验。
2. Sliding Puzzle 的训练效率不能把曼哈顿下界误当真实最短步数；3x3 要能做精确解距，4x4 要保守回退。

## 2. 本轮实际改动

### 2.1 London Tower

新增了按当前移动规则运行的 BFS 最优步数校验，并把结果写入 trial、summary 和 metrics。

新增关键字段：

- `validatedOptimalMoves`
- `optimalSource`
- `optimalMismatch`
- `planningEfficiency`
- `validatedOptimalRate`
- `avgPlanningEfficiency`
- `optimalValidationMismatches`
- `planningPrescription`

训练意义：

- 让“最优步数”从题库标注，变成可验证的训练事实。
- 让规划效率和路径偏离基于实际求解，而不是只看手写答案。

### 2.2 Sliding Puzzle

3x3 引入精确最短步数搜索；4x4 及以上保守回退到曼哈顿下界。

新增关键字段：

- `exactSolutionMoves`
- `solutionBasis`
- `solutionGapMoves`
- `solutionGapRate`
- `searchExpandedStates`
- `searchTimedOut`

训练意义：

- 3x3 可以看真实路径差距。
- 4x4 不会被不必要的精确搜索拖慢。
- 用户看到的效率和处方更接近实际能力边界。

## 3. 实际验证

本轮执行并通过：

```powershell
node --check london-tower.js
node --check sliding-puzzle.js
npm run smoke:flows
npm run smoke:pages
node scripts/check-sensitive-paths.js
node scripts/smoke-training-depth.js
git diff --check -- london-tower.js sliding-puzzle.js scripts/smoke-training-depth.js
```

额外的本地 smoke 结果显示：

- London Tower 题库中的手写 `optimal` 与 BFS 最短步数存在不一致，说明这次校验是有实际纠偏价值的。
- Sliding Puzzle 的 3x3 精确求解器可返回真实最短步数，验证了字段与算法链路可用。

## 4. 第三轮门禁

第三轮不再增加训练玩法，而是加一个深度门禁脚本：

- `scripts/smoke-training-depth.js`

它检查三类关键契约：

1. 注意力系统画像 helper 是否仍保留系统级摘要、chips、处方。
2. London Tower 是否仍保留 BFS 规划校验与处方字段。
3. Sliding Puzzle 是否仍保留精确解距/回退字段。

## 5. 复盘

### 5.1 做对的地方

1. 训练本体的“强”开始从文案变成可验证字段。
2. 题库手写最优值被实际规则校验纠偏。
3. 3x3 与 4x4 的处理策略分层，避免性能和精度互相拖累。
4. 新增的深度门禁把训练本体强度固化成可复跑检查。

### 5.2 风险

1. London Tower 的 BFS 题目空间很小，目前可承受；如果未来扩成更大题型，需要改成更明确的求解上限或抽样校验。
2. Sliding Puzzle 的精确搜索仅限 3x3；这是刻意的边界，不要把它误读成对所有盘面都可用。
3. 当前仓库还有其他未合并改动，本轮只做了训练本体关键路径加深。

## 6. 下一步建议

如果继续迭代，下一轮应从“深度门禁”转到“真实浏览器闭环”：

1. 用真实页面通关抽测 London Tower 和 Sliding Puzzle。
2. 确认保存结果里的新字段能被 report 或计划页消化。
3. 再决定是否给社交决策模块补相同级别的最优/对照校验。
