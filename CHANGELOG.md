Warning: truncated output (original token count: 95479)
Total output lines: 2388

# NavoPath 更新日志

## 2026-10-29 · Dock 调整手柄与竖屏时间轴添加 · 1.4.9

### 改进
- 桌面 Dock 竖屏时间轴的时长调整手柄移至任务块上下边缘的水平居中位置，便于鼠标拖动。
- 竖屏时间轴通过拖动添加任务时，暂时收起底部浮动按钮，让时间和归属控件保持可操作。

## 2026-10-28 · 桌面 Dock 鼠标交互与外观 · 1.4.7

### 改进
- 桌面版启动后及每 24 小时自动检查更新，发现新版主动提示；自动和手动检查均只需确认一次，即可自动下载、安装并重启，稍后更新时可从设置继续。
- 桌面版启动占位与系统界面默认使用浅色，保留已保存的工作区主题；顶部菜单栏默认隐藏，按 Alt 可临时显示，减少额外占用的顶部空间。
- 桌面 Dock 沿用竖屏布局，鼠标悬停时间轴任务即可显示时长调整手柄，按住直接拖动，单击展开详情短栏；保留触屏原有手势与排程逻辑。

### 修复
- 修复时间轴项目归属菜单的重复边框、名称与颜色标记错位，隐藏菜单滚动条并保留滚动和键盘操作。

## 2026-10-26 · 桌面贴边悬停 · 1.4.4

### 新增
- 桌面版可在今日候选“更多”中悬停 Dock 选择左侧或右侧；窗口切为竖屏并默认完全收起，鼠标靠近对应屏幕边缘时展开，离开窗口后再次收起。启用后菜单显示 Undock，退出时恢复原窗口大小、位置、置顶与最大化状态，并适应屏幕可用区域变化。

### 修复
- 官网首页顶栏“现在开始”在未登录时直接打开登录窗口，已登录时进入工作区；未登录时访问工作区也会显示登录入口，避免跳转后仍停留在首页。

## 2026-10-25 · 桌面版 1.4.2

### 改进
- 桌面版更新至 1.4.2，汇集近期规划、AI、手机布局与时间轴改进，包括月份和年份快速选择、月视图按日期快速添加，以及跨视图保留时间位置。

## 2026-10-24 · 导航、时间轴与顶栏手势

### 改进
- 竖屏展开日历后，可点按月份或年份切换为三列选择网格；左右箭头按当前层级翻页，快速跨月、跨年定位，再选择具体日期。
- 手机今日候选支持在整条顶栏上下滑动：上滑展开更多候选，下滑关闭；快速添加也可从标题栏上滑展开详情，保留轻点按钮与内容滚动。

### 修复
- 横屏与竖屏时间轴“回到现在”按正在查看的日期和时刻决定滚动方向：从过去向下返回，从未来向上返回，避免跨日期时方向颠倒。
- 竖屏三天视图的全天任务与日期列准确对齐；开启或关闭跨天滚动时，切换天、三天、周视图及从月视图返回均保留正在查看的时间位置。
- 月视图竖屏下点按日期旁的添加按钮会打开快速添加短栏，保留所选日期和项目；展开详情后也可继续添加到该日。
- 提前准备 AI 对话窗口；AI 与规划加载时使用与刷新页面一致的骨架占位，AI 保留关闭入口。关闭 AI 时竖屏底栏及时恢复，避免退场时短暂空白。
- 快速操作不同区域的导航时保留各自的选择，切换工作区不再丢失刚选中的规划或日历视图。
- 手机快速新增在每次打开时清空旧标题并恢复输入焦点，连续添加时避免重复提交上一次的内容，同时保留关闭时的平滑退场。
- 一天开始时间设为任意分钟时，单日、多日与周视图仍准确显示整点刻度和跨日日期。
- 页面与日期滑动时，导航、日期控件和浮动按钮保持显示，不再被内容遮住；返回执行页时不再叠加缩放淡入，只让变化的内容滑动。设置内部切换保留原有遮挡关系，背景控件不会浮到面板前。

## 2026-10-23 · 手机布局、规划与弹层

### 改进
- 执行与规划切换时底部导航保持原位，内容按页面方向左右滑动；日期切换也按前后方向滑动。今日候选从底部向上展开，关闭时平滑收起，并保留列表位置与键盘焦点。
- 常用页面提前准备，返回执行与规划时保留视图和滚动位置；减少时间轴与日期标签的重复绘制，设置首次加载时立即显示可关闭的占位反馈。
- 手机详情、快速添加、AI 与设置面板按底部方向展开和收起；设置层级、规划视图与日期月份按方向切换，搜索、通知和操作菜单具有成对的进退反馈。
- 今日候选的短任务右侧操作横排，长任务自动竖排，为多行标题留出宽度；移除顶部拉条，将规划图标、更多与关闭收进同一标题栏。习惯与任务采用一致的勾选框，优先级提示同步显示。
- 手机两侧浮动按钮保持对称，底部提示与撤销操作显示在按钮之间；AI 对话页左右贴边，日期入口与展开月历对齐，月历底部保留圆角。
- 规划页快速添加保留当前视图，新任务留在规划中；提前准备规划内容，首次打开时立即呈现布局占位反馈。
- 减淡勾选框内部填充和竖屏候选面板遮罩；展开候选面板时，时间轴仅保留滚动，点按只收起候选，不触发任务编辑、勾选或排程；容量提示可从右侧关闭。

### 修复
- 弹窗内键盘焦点保持在当前窗口，关闭后返回原入口；规划任务菜单支持 Esc 关闭。快速添加收起时保留内容，日程模板关闭时平滑退场。
- 连续点击日期会逐次前进或后退，快速切换页面与日历视图时保留最后选择；减少动态效果时缩短位移与进退过程，收起的面板不再接收操作。
- 手机短栏拖动时跟随手势移动，松手后平滑回位或收起；关闭面板、菜单或弹窗后立即重新打开，不再被旧的退出过程关闭。
- 修复竖屏今日候选“更多”菜单在触屏失焦后提前关闭、选项点击无响应的问题；AI 排程设置保持在屏幕内，保留点击外部与键盘关闭操作。
- 恢复详情抽屉与弹层的平滑动效，减少动态效果时缩短过渡；关闭详情后快速打开另一项任务，新详情不再被上一次关闭操作打断。
- 项目与时长选择弹层根据可见空间调整展开方向与高度，窄屏、短视口及窗口缩放时保持选项可见并可滚动。
- 修复时间轴上 15 分钟任务内容截断；竖屏时间轴底色延伸至右侧边缘，时间轴与全天栏任务块保持原位。

## 2026-10-22 · 手机排程流程

### 改进
- 手机竖屏执行页以日程为主屏，底部待安排抽屉保留候选列表与滚动位置；点按安排可预览推荐空档、点选时间调整，再确认或取消，支持撤销并保留其他执行记录。
- 收紧窄屏候选任务的标题行和上下留白，卡片随标题长度自然增高；复选框靠近标题，保留时长、日期与操作按钮的触控范围。
- 待安排入口改为左下角向上展开图标，与右下角添加按钮对称；拖动候选面板顶部横条可调整高度，松手后保留高度，列表仍可独立滚动。

### 修复
- 加入或移出今日候选时保留任务的日程、执行历史与投入度评分；自动排程避开跨午夜的占用时段，跨日任务在结束前保持已安排状态。
- MCP 投入度读取与评分支持未完成及返回规划的执行记录，与应用内规则一致；每次执行独立保存，取消的执行仍不参与评分。
- 勾选框直接绑定任务优先级的边框与淡色填充，切换高、中、低或未设置时不再被全局按钮样式覆盖。
- 修复开启投入度后全天项目色条被裁剪的问题；单日和多日全天栏新建任务时保留所选项目，项目色与归属在保存、刷新后保持一致。

## 2026-10-21 · 隐私政策与项目建议

### 新增
- 新增中英文隐私政策，说明账户、规划、云端同步及可选功能的数据处理方式；首页、产品页和账户设置可随时查阅。
- 网页与桌面登录、注册须主动勾选同意隐私政策后才能提交；切换登录或注册时重新确认，邮箱确认后的继续入口遵循同一要求。

### 改进
- 候选任务的项目建议覆盖右侧时长、排程与更多控件，不再撑高任务块；可点击 × 关闭并恢复原控件。

### 修复
- 任务编辑与新建中的优先级选项直接更新勾选框颜色；清空优先级后保持未设置状态，重新打开或刷新不再恢复为中优先级。

## 2026-10-20 · 深色背景

### 改进
- 深色模式采用更接近黑色的背景，统一调暗面板、任务块、时间轴和输入框底色；减轻时间条纹、弹层、规划视图与 AI 消息的灰色蒙层，保留柔和文字与清晰的表面层次。
- 深色模式的逾期与警示改用柔和玫瑰色，优先级、项目标记和投入度色条降低饱和度并限制亮度，项目名称使用中性文字；保留项目原始颜色及浅色模式显示。

## 2026-10-19 · 未完成任务拖动

### 改进
- 时间轴与全天栏中返回规划的未完成任务支持拖动，移动后保留未完成状态及该次执行的投入度，其他执行记录保持不变。

## 2026-10-18 · 界面对齐

### 修复
- 窄屏执行顶栏保留滑动标志切换，日期与两侧控件互不重叠；周视图日期与星期对齐，英文首页顶栏在窄屏保持单行。
- AI 提供商设置在手机和平板上保持标题在上、表单在下；指标筛选菜单使用清晰底色，并与工具栏对齐，选项保持在屏幕内。
- 模板窗口打开时收起底部导航与浮动添加按钮，确保取消和应用按钮完整可见；右上角新建与关闭按钮使用相同尺寸的图标并对齐。
- 缩小手机首页的主标题、分区标题和宣传语，以及执行页日期、设置页、插件说明和更新日志标题，保持正文可读。
- 任务编辑中的投入度移到优先级右侧，文字、滑杆和百分比保持同行；移除下拉框及信息图标，悬停或点按投入度文字即可查看说明。

## 2026-10-17 · 竖屏导航与个人资料

### 改进
- 投入度可在任务完成前选择，未完成及返回规划的执行记录同步显示投入度色条；每次执行独立评分，切换完成状态后保留。
- 设置的“通用”分区可关闭应用内通知角标，关闭后仍可查看通知中心。
- 竖屏底栏右下角“更多”使用系统原生选项列表，集中提供通知、搜索与设置；竖屏设置首页不再重复显示通知入口。
- 清理候选任务、时间轴、月视图、规划树、列表、看板与矩阵中的多余拖动外框；排序落点改用单条插入线，AI 待确认任务、外部日历、模板与空状态采用简洁边界，去掉引导区域的虚线框。

### 修复
- 竖屏快速添加弹层打开时隐藏浮动添加按钮，关闭后恢复；右下角“更多”的通知角标收进按钮范围，避免被屏幕边缘裁切。
- 竖屏长按拖动时间轴任务时，靠近顶部或底部会持续滚动时间轴，并同步更新落点时间；松手或取消拖动后停止滚动。拖入全天栏时沿用任务卡片显示放置预览，去掉额外的虚线框与外层框线，松手后安排到预览对应日期。
- 全天任务与“回到现在”保持同行；竖屏有任务时“回到现在”收为图标按钮，为任务留出宽度。
- 用户名与头像在竖屏设置首页及横屏“账户与资料”分区显示，修改后立即保存；调整其他设置时保留云端较新的个人资料，失败重试保留未保存的修改，并可从同一账户的浏览器缓存恢复缺失资料。

## 2026-10-16 · 竖屏交互

### 改进
- 右下角快速添加按钮改用纸面底色、清晰细描边与轻量加号，去除厚重阴影；浅色使用黑色描边，深色使用浅色描边，保留足够的触控范围，并随当前页面主题显示。
- 竖屏底栏增加全局搜索入口，可搜索任务、项目、习惯与设置；搜索面板随可见屏幕高度调整，提供直接关闭按钮。

### 修复
- 修复竖屏“回到现在”出现时挤压全天任务的问题，按钮与任务分行显示，多项任务不再被压缩裁切；单日跨天滚动时，日期栏与全天任务跟随屏幕顶部所在日期，避免临近午夜时提前切到次日而隐藏当天任务。“回到现在”在首次进入后即可随滚动更新；竖屏与横屏全天任务在点按或悬停时不再出现虚线外框。
- 修复竖屏端长按今日候选后拖入时间轴，以及规划树、看板、矩阵与列表中的触控拖动被中断的问题；松手完成安排或调整，普通滑动继续滚动列表。
- 竖屏规划筛选在同一面板内并排显示分类与选项，避免相互遮挡；支持直接点按切换分类，长列表可滚动。

## 2026-10-13 · 任务操作与日程安全

### 修复
- 修复桌面构建的图标路径，并统一新环境的云端权限配置。
- AI 安排保留同一任务的其他执行记录与历史记录；改期只移动明确对应的日程，多次安排不会互相覆盖。
- 快速改期会检查目标日期的任务、重复日程与日历事件，包括跨午夜冲突；遇到已占用时段会提示调整，避免覆盖已有安排。
- 撤销候选与安排时保留随后新增的任务、笔记及编辑；多次执行任务在全部有效记录完成后标记完成，取消完成同步恢复对应状态，历史未完成与跳过记录保留各自状态和显示。
- 竖屏任务短编辑栏提供“删除任务”按钮，可直接删除任务并关闭编辑栏；删除后刷新保持结果。

## 2026-10-11 · 竖屏时间轴交互

### 改进
- 手机时间轴支持从任务块上滑动滚动；点按一次选中，再次点按打开短编辑栏，选中后可拖动左上角与右下角调整时间。长按任务后显示浮起反馈，支持的设备提供轻微震动，再拖动可移动任务。
- 通知中心右上角增加一键清除，清除全部当前提醒；打开时收起底部导航与添加按钮，避免遮挡。

### 修复
- 修复触摸悬停与项目标签干扰任务点按的问题；编辑短栏适应可见屏幕与软键盘，底部内容可滚动到达。短栏进一步收紧，展开与关闭按钮同行对齐，展开图标沿用 AI 栏样式；向上拉起或点击展开时，面板从短栏实际高度向上展开为完整编辑页，减少动态效果时直接展开。短栏操作按钮统一细描边、透明底色与字重，完成和未完成状态不再加深颜色或叠加粗描边。

## 2026-10-10 · 连接器功能入口

### 新增
- NavoPath 连接器支持查看任务详情、执行与计时记录、习惯每日完成记录，以及按任务、项目或执行开始日期查询投入度与加权时长。可保存用户提供的单次已完成执行评分，并使用审计、幂等和撤回；可切换投入度功能，关闭后保留评分。

## 2026-10-09 · 规划与任务定位

### 新增
- 设置中可开启投入度评分，默认关闭；已完成任务可按每次执行以 10% 为一档评 10–100%，默认 80%，滑块与快速选择使用相同十档，已有评分就近对齐。时间轴左侧项目色条从顶部向下填充，100% 填满、50% 填充上半段，悬停色条显示“投入度：百分比”；任务背景与内容保持原样，单日、3 天与周视图的色条底色和宽度一致。详情将说明图标、名称、评分与滑杆横向排列，点击百分比可按 10% 一档快速选择，悬停、聚焦或点击说明图标可查看含义与计算方式；统计按时长 × 投入度计算，关闭后恢复原始时长并保留评分。

### 改进
- 任务编辑页统一标题层级、分组间距与内容对齐，收紧操作区并移除标题下的多余空白，手机端保持清晰的纵向排布，长标题在窗口缩放时稳定调整高度。
- 快速改期保留任务原来的开始时间与时长，包括跨午夜安排；“查看日程”切换至对应日期并定位到任务时间。
- 任务详情“更多”菜单提供时间轴与规划位置跳转，仅显示有对应任务数据的入口；规划跳转自动展开项目并显示目标任务，跳转后沿目标任务自身外框与圆角短暂加粗高亮边框，不影响任务块布局。
- 任务详情未完成与快速改期的悬停列表宽度贴近对应按钮，长选项自动换行。

### 修复
- 月视图任务块沿用共享样式，按实际日程显示多次执行、重复安排与跨日片段；拖动即时更新对应日程并保留时间和时长，与时间轴同步。点击日期或日期空白处进入当天时间轴并定位首项安排，添加任务使用日期旁的加号；星期顺序跟随设置，手机顶栏使用简短月份标签，切换动画中断时仍能完成跳转。
- 修复规划页滚动到底部的页面错位与添加按钮偏移，悬浮按钮保持在窗口内。
- 任务标记选择框的选中圆角与外框保持一致。
- 规划页新建任务有未保存修改时，点击外部、关闭或按 Escape 会提示保存；取消会放弃新建任务并退出，保存按钮使用更明显的主题色描边与浅色底。

## 2026-10-08 · 首页与执行体验

### 改进
- 首页加载时，四个透视页面从四周向内汇聚，中央 N Logo、NavoPath 与标语依次浮现，再由顶部滑入顶栏、底部滑入产品预览；滚动或操作时立即结束入场动画，保留页面展开与原有滚动效果，减少动态效果时直接显示首页。

### 修复
- 时间轴与今日候选中的习惯完成状态双向同步，勾选或取消完成会同时更新；已完成的习惯重新安排后保留完成状态，各日期独立记录。
- 任务详情备注点击后保持只读，使用笔形按钮进入编辑；修改后显示保存与取消，取消会放弃修改，支持中英文。

## 2026-10-06 · 网站介绍上线

### 新增
- 发布执行、规划、Navo AI 与六项相关原理的中英文介绍；首页提供透视页面入口和清晰的产品、原理与个人网站链接。

## 2026-10-05 · 首页与产品介绍

### 新增
- 首页 Logo 两侧加入执行、规划、Navo AI 与相关原理四个透视页面入口，点击后转正并展开铺满窗口，向下滚动时四个入口向两侧渐隐；手机端保留四个可点击入口，减少动态效果时直接打开页面。
- 新增中英文“相关原理”目录与六个独立主题页，介绍 JEV 的任务估时与项目归类、置信度和个人记录、时间安排规则、操作预览与撤回、多视图共用任务数据、任务与时间记录分离。目录采用简短摘要与宽松留白，详情以流程示意和分段短文介绍；可从产品页顶栏访问，手机端保持静态阅读。

### 改进
- 首页与产品介绍页共用“产品、相关原理、支持”三个顶栏入口：产品菜单按执行、规划、Navo AI 排列，相关原理菜单包含六个主题；悬停、手机点击和键盘均可展开，窄屏下拉保持在窗口内，下拉菜单与顶栏同色、贴合底边并使用小圆角，始终盖住介绍文字；顶栏在能容纳时保持一排，避免较窄桌面与平板提前换行。首页跳转更轻快，加载过程中保留页面预览。支持入口包含爱发电、GitHub 与个人网站。
- Navo AI 介绍页沿用执行介绍页的三列布局：左侧今日候选、中间说明、右侧时间轴。移除大箭头，安排按钮在首次点击前保持粗浅描边，并有指针从画面中间移动到按钮、变成手势点按的循环引导，首次点击后停止；等待时在中间解释估时、休息与可调整安排，任务随后按时间顺序轻轻淡入并落位。保留改期与撤回，减少动态效果时直接呈现结果。
- 首页底部开始按钮沿用顶栏的深色圆角样式；页脚左侧提供执行、规划与 Navo AI 链接，中间姓名链接到个人网站，右侧直接进入 JEV 原理介绍，移除旧标语和支持链接。所有页脚链接增加细下划线，并缩小左右留白，使两侧链接更靠近页面边缘。
- 正式工作区与介绍页共用今日候选底部添加栏和规划项目样式：添加按钮完整留在容器内并居中，项目四边以项目色等宽描边，不再使用左侧色条。

## 2026-10-04 · 产品介绍页

### 改进
- 介绍页使用 Times New Roman，说明标题统一放大，开头增加向下滚动提示；今日候选采用任务字体并留出更充裕的宽度，时间轴保持靠右，项目名使用常规字体。日期仅作展示，收起日期与视图切换、回到现在及加号、AI 快捷入口，保留任务安排与完成操作。
- 规划与执行介绍页使用全屏产品工作区：规划任务缩进更清晰、卡片更紧凑，右侧展示说明；执行保留左侧候选、将时间轴靠右，中间说明正常滚动，后续每段在视觉中心短暂停留，到上下两端时才逐渐缩小、淡出并轻微模糊。较窄的桌面窗口仍显示说明；三个介绍页的竖屏版本仅展示文字、导航和可展开的常见问题，不加载可交互产品，横屏保留产品体验。规划与执行介绍页仅使用整页滚动，先读完说明再进入下方内容；产品面板保持静止并保留操作，时间轴适应示例一天。规划默认展开网站与学习项目、收起运动项目，项目块使用项目色边框并去除左侧色条，右侧说明收紧留白且统一宽度；矩阵四个象限补齐例子并保持等高。今日候选底部添加按钮完整显示在容器内。执行页说明居中并统一两侧留白；三个介绍页补充常见问题并使用细加号展开，顶栏统一为执行、规划、Navo AI、相关原理和支持五项，中英文切换的外框与滑块圆角保持一致。示例操作独立于个人数据。
- 规划与执行介绍页复用产品顶栏，可直接切换执行、规划与 Navo AI，左上角返回首页；支持入口包含爱发电、GitHub 与个人网页占位，相关原理暂保留占位。首页保持现状。Navo AI 介绍页采用左侧今日候选、右侧时间轴的原生布局，引导点击今日候选右上角原有的安排图标。等待时简要说明任务估时、休息和可调整安排，再将六项候选移入时间轴，包括午餐与休息以及 15:30 的课程笔记；安排后显示改期与撤回，逐步体验预设操作，无需输入或连接真实 AI。

### 修复
- 执行示例去掉旧事件，将零碎安排合并为较大的任务块，留出午餐与休息时间，使用自然的连续安排和少量短间隔，保留空闲时段供访客尝试安排。
- 修复安排按钮首次点击被悬停预览打断的问题；AI 建议应用和调整使用时间记录，避免与已有安排冲突，并支持撤回。
- 手机 AI 面板保持建议与操作按钮完整可见，底部导航不再遮挡弹层。
- 恢复 ChatGPT 通过 OAuth 连接 NavoPath MCP，并修复授权确认页的加载；现有专用令牌继续兼容。

## 2026-10-03 · 时间轴位置稳定性

### 新增
- 新增规划、执行与 AI 三个中英文功能页，使用可操作的示例任务介绍从目标到执行的流程；首页产品菜单可直接访问。
- 功能演示支持跟随讲解、自由探索、重置，以及安排预览的应用与撤回；示例操作独立于个人工作区。

### 修复
- 在执行页与规划页之间反复切换时，保留时间轴的滚动位置与显示日期，覆盖开启和关闭跨天滚动的日、三日与周视图。

## 2026-09-30 · 同步配置说明

### 改进
- “同步”页先展示账户、手机与云盘镜像的双向路径和桥接状态；已配置时收起首次安装步骤，并说明隐藏令牌输入、常见配置失败及云盘上传状态的查看位置。

### 修复
- 修正任务优先级勾选框在候选、日程和规划视图中的颜色显示；优先级菜单只更新任务优先级。
- 手机重新打开工作区时先核对账户云端版本，再处理逾期任务；手动同步前也会读取最新云端数据，避免旧缓存将电脑端已删除的今日候选或规划任务重新写回。
- 执行页和今日候选页只在右下角保留快速添加悬浮按钮；任务编辑面板会随手机动态视口高度调整，并可在内容过长时滚动。
- 时间轴偏离现在时间时，“回到现在”移至「全天」行最右侧并加粗；点击后平滑滚回当前时间，时间线短暂高亮，竖屏与横屏表现一致。刷新后，竖屏时间线准确定位在视口高度的 1/3 处。
- 修正竖屏回位按钮的定位，使其与「全天」栏标签上下对齐；单击回位时暂停连续跨天重排，并在平滑滚动结束后校准到今天的当前时间。
- 规划筛选按钮移入顶部工具栏并避开安全区；执行页快速添加按钮移至独立视口层，确保高于底栏且留有安全间距。
- 设置首页将账户资料放进可滚动区域并隐藏工作区底栏；修改姓名后立即等待持久化完成，失败时保留编辑状态并提示重试。
- 规划页项目操作按钮去掉描边、加深图标；筛选按钮与规划顶栏对齐。

## 2026-09-29 · 竖屏控件与云盘同步

### 新增
- 「日历与集成」新增“同步”：可复制 Agent 配置提示词，让常开电脑把工作区与自己的云盘文件夹双向同步，并查看运行状态；另有手动备份教程。

### 修复
- 工作区版本冲突现在返回明确的 409，避免数据库 API 反复重试同一写入并耗尽连接池。
- MCP 令牌校验遇到云端故障时返回可重试的 503，避免误提示令牌已失效。
- 刷新及“回到现在”时，竖屏时间轴将目标时间对齐到整个视口高度的 1/3 处。
- 规划页筛选按钮固定在右上方并避开顶部安全区；任务框右侧操作按钮取消描边，保留键盘焦点提示。
- “回到现在”改为轻量无边框图标按钮，并保留 44px 触控区域。
- 恢复任务勾选框的优先级提示：无优先级为黑框，低优先级为蓝框并带淡蓝底色，中、高优先级分别使用橙框和红框。；浏览器缩放时保持方框比例。

## 2026-09-28 · 移动端导航与同步修复

### 修复
- 移动端工作区底栏移到应用容器外并固定在视口底边；执行页与规划页共用同一定位规则，安全区留白由底栏内部承接。
- 手动同步遇到 Supabase JWT 401 时会刷新会话并重试；工作区云端读写设有 15 秒上限，令牌仍被拒绝时会提示重新登录。
- 手动同步在页面切到后台后仍会继续执行；上次同步时间不再重复显示相同的日期。
- 今日候选同项目拖动不插入空槽，并在拖动任务块下方提示放置方向；跨项目拖动时以完整细框标出目标项目，归属提示与项目色条右侧对齐。移除拖动卡片下方多余的半透明方框，源任务占位不显示方框，拖动卡片的按钮不描边，勾选框保持垂直居中。
- 竖屏任务页把快速添加移入顶部工具区，避免悬浮按钮遮住任务；日程页保留加号并与底部导航拉开间距。拖拽提示现在演示长按后自动切到日程并放置任务，支持减少动态效果和记忆关闭状态；日期切换与视图选择控件扩大到 44px。
- 竖屏触控页面不再因长按普通文字触发文本选择，输入框和可编辑区域仍可选择文字。
- 竖屏规划页筛选按钮避开顶部安全区；执行页与规划页的底栏移出带变换的应用壳，统一按视口底边定位，执行页日程勾选框缩小可见方框，同时保留 44px 触控区域。

# NavoPath Changelog

## 2026-10-29 · Dock Resize Handles and Portrait Timeline Quick Add · 1.4.9

### Improved
- Desktop Dock portrait timeline resize handles now sit at the horizontal center of the top and bottom task edges for easier mouse dragging.

### Fixed
- When adding a task by dragging on the portrait timeline, the bottom floating buttons are hidden so the time and project controls remain usable.

## 2026-10-28 · Desktop Dock Mouse Gestures and Appearance · 1.4.7

### Improved
- Desktop checks for updates at startup and every 24 hours and prompts when a new version is available. Automatic and manual checks both need just one confirmation to download, install and restart; deferred updates remain available in Settings.
- Desktop startup placeholders and native controls default to light mode while preserving the saved workspace theme. The menu bar stays hidden until Alt is pressed, freeing up vertical space.
- Desktop Dock keeps the portrait layout with mouse gestures: hover over timeline tasks to reveal resize handles, drag directly, and click once to open the detail short sheet. Touch gestures and scheduling behavior stay consistent with portrait mode.

### Fixed
- Fixed nested borders and misaligned names and color markers in the timeline project assignment menu; hid menu scrollbars while preserving scrolling and keyboard controls.

## 2026-10-26 · Desktop Edge Hover · 1.4.4

### Added
- Hover over Dock in Today's Candidates → More and choose Left or Right. The portrait window stays completely hidden until the pointer approaches that screen edge, and hides again when the pointer leaves the window. The menu changes to Undock while enabled; undocking restores the previous size, position, always-on-top and maximized states, while docking adapts to display work area changes.

### Fixes
- The homepage Start now button opens the sign-in dialog directly when signed out and enters the workspace when signed in. Opening the workspace while signed out also shows the sign-in dialog instead of leaving users on the homepage.

## 2026-10-25 · Desktop 1.4.2

### Improvements
- Desktop 1.4.2 brings together recent planning, AI, mobile layout, and timeline improvements, including quick month and year selection, date-specific quick add in month view, and preserved timeline position across views.

## 2026-10-24 · Navigation, Timeline, and Header Gestures

### Improvements
- In the expanded portrait calendar, tap the month or year to replace dates with a three-column picker. Arrows page through the current level, letting you jump across months or years before choosing a day.
- Swipe the full Today’s Candidates header up to expand the list or down to close it on phones. Quick Add also expands to details with an upward header swipe, while taps and content scrolling remain available.

### Fixed
- “Back to now” uses the date and time in view to scroll forward from the past and backward from the future in both portrait and landscape, avoiding reversed motion across dates.
- All-day tasks align with their date columns in the portrait three-day view. With cross-day scrolling enabled or disabled, switching between day, three-day, and week views, or returning from month view, preserves the time position being viewed.
- In portrait month view, the add button beside a date opens the quick-add sheet and retains the selected date and project, including when expanded to full details.
- Prepare the AI dialog ahead of time. AI and Planning use skeleton placeholders consistent with page refreshes, with AI remaining dismissible while loading. Restore the portrait bottom navigation as AI closes, avoiding a brief blank area during the exit.
- Rapid navigation in different areas preserves each selection; switching workspaces no longer discards a newly selected planning or calendar view.
- Mobile quick add opens with a fresh title and restored input focus, avoiding resubmission of the previous entry while keeping a smooth closing animation.
- Day, multi-day, and week views correctly show hour ticks and day-boundary dates when the day starts at any minute.
- Navigation, date controls, and floating actions stay visible during page and date slides without content covering them. Returning to Execute no longer replays scale-and-fade entrances; only changing content slides. Settings navigation preserves overlay order so background controls stay behind the panel.

## 2026-10-23 · Mobile Layout, Planning, and Popovers

### Improvements
- Bottom navigation stays fixed while Execute and Planning content slides in the corresponding direction. Date navigation also slides forward or backward. Today's Candidates slides up from the bottom and smoothly closes, preserving list position and keyboard focus.
- Common pages prepare ahead of time, preserving views and scroll positions when returning to Execute or Planning. Reduced repeated timeline and date-label rendering, with immediate dismissible placeholders while Settings first loads.
- Mobile details, quick add, AI, and Settings panels enter and exit from the bottom. Settings levels, Planning views, and calendar months switch directionally, while search, notifications, and action menus have paired entrance and exit feedback.
- Lighten checkbox fills and the portrait candidate drawer backdrop. While the drawer is open, the timeline supports scrolling and taps only dismiss the drawer without editing, completing, or scheduling tasks. Capacity notices can be dismissed from the right.
- Today's Candidates keeps actions horizontal for short titles and stacks them vertically for long titles, leaving more room for wrapping. Removed the resize handle and placed the Plan icon, More, and Close in one header. Habits and tasks share consistent checkboxes with task priority hints.
- Mobile floating actions remain symmetric, with notices and undo actions between them. AI chat reaches both screen edges, and the date control and expanded calendar align with rounded lower corners.
- Quick add in Planning preserves the current view and keeps new tasks in Planning. Planning content is prepared ahead of time, with immediate layout placeholders on first open.

### Fixed
- Keyboard focus stays within the current dialog and returns to its opener after closing; Planning task menus support Escape dismissal. Quick add retains its content while closing, and schedule templates now exit smoothly.
- Repeated date navigation applies every step, and rapid page or calendar-view changes preserve the latest selection. Reduced motion shortens movement and transitions, and collapsed panels no longer receive input.
- Mobile short sheets follow dragging gestures and smoothly return or close on release. Reopening a panel, menu, or dialog during its exit no longer lets the previous exit close it.
- Fixed Today's Candidates More menu dismissing before touch selections activate in portrait mode. AI scheduling settings stay within the screen, with outside-click and keyboard dismissal preserved.
- Restored smooth detail drawer and popover animations with shorter transitions for reduced motion. Quickly opening another task during a drawer exit now keeps the new details open.
- Project and duration pickers now adapt their direction and height to the visible space, keeping options reachable by scrolling on narrow screens, short viewports, and resized windows.
- Prevent content clipping in 15-minute timeline tasks. Extend portrait timeline hour bands to the right edge while keeping timed and all-day task blocks in place.

## 2026-10-22 · Mobile Scheduling

### Improvements
- Portrait phone execution now opens on the schedule with a bottom candidate drawer that preserves its list position. Tap Plan to preview a suggested slot, choose another time, then confirm or cancel; undo and other execution records are preserved.
- Narrow-screen candidate cards now fit their title height with less vertical whitespace. Checkboxes align near the title while duration, date, and action controls retain their touch targets.
- The candidate opener is now an upward chevron in the lower-left corner, matching the lower-right Add button. Drag the panel's top handle to resize it; the chosen height remains on release while the list scrolls independently.

### Fixed
- Adding or removing a Today's Candidate preserves its schedules, execution history and engagement ratings. Automatic scheduling avoids occupied cross-midnight time, and overnight tasks remain scheduled until they end.
- MCP engagement queries and ratings now include unfinished and returned executions, matching the app. Each execution keeps its own rating, while cancelled executions remain excluded.
- Checkbox borders and subtle fills now follow task priority directly, so global button styles cannot override high, medium, low or unset states.
- Fixed clipped project stripes in the all-day shelf when Engagement is enabled. Tasks created in daily and multi-day all-day shelves retain the selected project, keeping their project color and assignment after saving and refreshing.

## 2026-10-21 · Privacy Policy and Project Suggestions

### Added
- Added a bilingual Privacy Policy explaining data handling for accounts, plans, cloud sync and optional features, accessible from the home page, product pages and account settings.
- Web and desktop sign-in and sign-up require an explicit Privacy Policy checkbox before submission; switching between them requires confirmation again, including the continue action after email confirmation.

### Improvements
- Candidate project suggestions overlay the duration, scheduling and more controls without increasing task height; click × to dismiss and restore the controls.

### Fixed
- Priority controls in task editing and creation now update checkbox colors directly; clearing priority stays unset after reopening or refreshing instead of reverting to medium.

## 2026-10-20 · Dark backgrounds

### Improved
- Dark mode uses backgrounds closer to black, with darker panels, task blocks, timeline and input surfaces; reduced gray washes across hour bands, overlays, planning views and AI messages retain soft text and distinct surface layers.
- Dark mode uses muted rose for overdue and alert text, subdued priority marks, project markers and engagement stripes with controlled brightness, and neutral project names; saved project colors and light-mode appearance are preserved.

## 2026-10-19 · Drag unfinished tasks

### Improvements
- Unfinished tasks returned to planning can be dragged from the timeline and all-day area. Moving preserves their unfinished status and per-execution engagement without changing other execution records.

## 2026-10-18 · Interface alignment

### Fixed
- The narrow Execute toolbar retains its sliding-logo switch without overlapping dates and controls. Week dates and weekdays align, and the English homepage header stays on one row on narrow screens.
- AI provider settings keep their heading above the form on phones and tablets; metrics filters use an opaque surface, align with the toolbar, and keep their options within the screen.
- Opening templates hides the bottom navigation and floating add button so Cancel and Apply remain fully visible; the top-right New and Close controls use equally sized, aligned icons.
- Reduced mobile homepage display headings, section headings, and tagline sizes, along with Execute dates and headings in Settings, the plugin guide, and release notes, while keeping body text readable.
- Task editing places engagement to the right of priority, keeping the label, slider, and percentage on one row. Removed the dropdown and info icon; hover over or tap the Engagement label to view its explanation.

## 2026-10-17 · Portrait navigation and profile details

### Improvements
- Engagement can be rated before completing a task. Unfinished executions, including those returned to planning, display the same engagement stripe; each execution keeps its own rating across completion changes.
- General settings can hide in-app notification badges while keeping the notification center available.
- The bottom-right More control uses a system-native option list for Notifications, Search, and Settings. Removed the duplicate notification entry from compact Settings home.
- Removed extra drag frames across candidates, timelines, month view, planning trees, lists, boards, and matrices. Reorder destinations use one insertion line; pending AI tasks, external calendars, templates, and empty states use simple boundaries, and onboarding areas no longer show dashed frames.

### Fixed
- Hide the floating add button while portrait quick add is open and restore it on close. Keep the bottom-right More notification badge inside the button bounds to prevent edge clipping.
- Holding a timeline task near the top or bottom while dragging in portrait continuously scrolls the timeline and updates the drop time. Scrolling stops on release or cancellation. Dragging into the all-day row previews the task card without extra dashed or surrounding outlines, and schedules to the previewed date on release.
- All-day tasks and Back to now stay on the same row. With portrait tasks present, Back to now becomes an icon button to preserve task width.
- Username and avatar appear on portrait Settings home and in the landscape Account & Data section, and edits are saved promptly. Changing other settings preserves newer cloud profile details, retries retain unsaved edits, and missing profile details can be recovered from the same account's browser cache.

## 2026-10-16 · Portrait interactions

### Improvements
- Restyled the bottom-right quick-add button with a paper surface, a clear fine border, and a lighter plus icon, removing the heavy shadow. Light mode uses a black border and dark mode uses a light border, preserving its touch target and matching the active page theme.
- Added global search to the portrait navigation for tasks, projects, habits, and settings. The search panel adapts to the visible screen height and includes a close button.

### Fixed
- Fixed all-day tasks being squeezed when Back to now appears in portrait mode by placing the button and tasks on separate rows, and prevented multiple tasks from being compressed and clipped. During continuous daily scrolling, the date header and all-day tasks follow the day at the top of the viewport, preventing today's tasks from disappearing before midnight. Back to now updates while scrolling from the first visit. Removed the dashed outline on all-day task tap or hover in both orientations.
- Fixed interrupted touch drags from Today's Candidates to the portrait timeline and within the Planning tree, Kanban, Matrix, and List views. Release to schedule or apply an adjustment; ordinary swipes continue scrolling lists.
- Portrait Planning filters now show categories and options side by side within one panel, preventing overlap. Tap to switch categories and scroll longer lists.

## 2026-10-13 · Task actions and schedule safety

### Fixed
- Corrected icon paths in desktop builds and aligned cloud permissions for new environments.
- AI scheduling preserves other executions and history for the same task. Rescheduling moves only the identified execution, and multiple arrangements no longer overwrite one another.
- Quick rescheduling checks tasks, recurring schedules and calendar events on the destination date, including overnight conflicts. Occupied times prompt an adjustment instead of overlapping existing plans.
- Undoing candidate and scheduling actions preserves later tasks, notes, and edits; tasks with multiple executions finish only after all active records are complete, and reopening an execution updates the task consistently. Historical unfinished and skipped executions retain their own status and appearance.
- The portrait task short editor now includes a Delete task button that deletes the task and closes the editor; deletion persists after refresh.

## 2026-10-11 · Portrait timeline interactions

### Improvements
- Scroll the mobile timeline starting on task blocks. Tap once to select, tap again for the short editor, and drag the upper-left or lower-right corner to resize. Hold a task for raised feedback and a light vibration on supported devices, then drag to move it.
- Added Clear all beside the notification center close button to dismiss all current reminders. The bottom navigation and add button hide while the center is open to keep messages unobstructed.

### Fixes
- Fixed touch hover and project labels interfering with task taps. The short editor fits the visible screen and keyboard and keeps bottom content reachable by scrolling. The shorter sheet aligns Expand and Close in one row and reuses the AI panel's expand icon. Swiping up or tapping Expand grows the panel upward from the sheet's actual height into the full editor, or opens it immediately when reduced motion is enabled. Short-sheet action buttons share thin outlines, transparent backgrounds, and consistent font weight; Complete and Incomplete no longer darken or gain a heavy outline when selected.

## 2026-10-10 · Connector capabilities

### Added
- The NavoPath connector can read task details, execution and time entries, daily habit completion records, and engagement ratings with weighted durations filtered by task, project, or execution start date. Save user-supplied ratings for individual completed executions with audit, idempotency, and undo, and toggle Engagement while retaining saved ratings when disabled.

## 2026-10-09 · Planning and task navigation

### Added
- Optional engagement ratings in Settings, off by default. Rate each completed execution from 10–100% in ten steps, defaulting to 80%; the slider and quick choices share the same steps, with existing ratings rounded to the nearest step. The left project stripe fills downward from the top: 100% fills its height and 50% fills the upper half. Hover over the stripe to see “Engagement: percentage”; task backgrounds and content keep their usual appearance. Stripe background and width are consistent across day, 3-day, and week views. Details arrange the info icon, label, rating, and slider in one row; click the percentage for quick choices in 10% increments, or hover, focus, or tap the icon for an explanation and calculation. Statistics weight duration by engagement; turning it off restores original durations and preserves ratings.

### Improvements
- Task editing aligns title hierarchy, section spacing, and content edges with the workspace; compact actions and an auto-sized title remove excess whitespace while preserving a clear mobile layout and stable long-title resizing.
- Quick reschedule preserves the original start time and duration, including overnight schedules; View schedule opens the target date and scrolls to the task time.
- The task detail More menu links to available timeline and Planning locations; Planning navigation expands the project and reveals the target task, briefly highlighting a thicker border along its own frame and corners without shifting its layout.
- Task detail Incomplete and Quick reschedule hover lists stay close to their trigger widths, with longer options wrapping automatically.

### Fixes
- Month tasks use shared styling and show each execution, recurring schedule, and overnight slice. Dragging immediately updates the selected schedule, preserves its time and duration, and stays in sync with the timeline. Clicking a date or its empty area opens that day's timeline at its first scheduled item; use the plus beside the date to add a task. Weekday order follows Settings, the mobile toolbar uses a short month label, and navigation completes even if its animation is interrupted.
- Fixed Planning layout shifts at the bottom and the misplaced Add button; floating controls stay inside the viewport.
- Task flag selection corners now follow the outer frame.
- Unsaved new tasks in Planning prompt to save when clicking outside, closing, or pressing Escape; Cancel discards the new task and closes the editor, with a clearer theme-colored outline and tint on Save.

## 2026-10-08 · Homepage and execution experience

### Improvements
- On homepage load, the four perspective pages gather inward while the central N logo, NavoPath and tagline emerge in sequence, followed by the header sliding in from above and the product preview from below. Scrolling or interaction ends the entrance immediately, preserving page expansion and existing scroll effects; reduced motion shows the homepage directly.

### Fixed
- Habit completion now syncs both ways between the timeline and Today's Candidates when checked or unchecked. Scheduling a completed habit preserves its completion, with each date recorded independently.
- Task notes stay read-only when clicked and use a pencil button to enter editing. Changes reveal Save and Cancel actions; Cancel discards the draft. Both Chinese and English are supported.

## 2026-10-06 · Product website introductions

### Added
- Published bilingual Execute, Planning, Navo AI and six Principles introductions, with perspective homepage entrances and clear product, principles and personal-site links.

## 2026-10-05 · Homepage and product introductions

### Added
- Added four perspective page entrances around the homepage logo for Execute, Planning, Navo AI and Principles. Clicking straightens and expands the page to fill the window; scrolling down slides the entrances outward and fades them away. Phones keep all four entrances; reduced motion opens the destination directly.
- Added a bilingual Principles directory with six separate topic pages: JEV duration and project predictions, confidence and personal records, scheduling rules, previews and undo, shared task data across views, and separate task/time records. The directory uses short summaries and generous spacing; articles combine an illustrative flow with brief sections. All are accessible from the product navigation and remain static reading pages on mobile.

### Improvements
- The homepage and product introductions share Product, Principles and Support navigation. Product lists Execute before Planning, followed by Navo AI; Principles contains six topics. Menus support hover, mobile taps and keyboard controls, and stay inside narrow windows, with dropdowns matching the header color, meeting its bottom edge and using small corners. Menus remain above introduction text. Headers stay in one row when space allows, avoiding early wrapping on narrower desktops and tablets. Homepage transitions are shorter and keep a page preview visible while loading. Support includes Afdian, GitHub and the personal website.
- Navo AI follows the Execute introduction’s three-column layout: Today’s Candidates on the left, explanations in the middle, and the timeline on the right. The large arrow is removed. The original scheduling icon keeps a thick, pale outline, with a looping cursor that travels from the center and changes into a tapping hand until first activation; the middle explains estimates, breaks and reversible changes during the wait. Tasks then fade and settle into place in time order. Reschedule and Undo remain available; reduced motion shows the result directly.
- The bottom homepage start button uses the same dark rounded style as the header. Footer product links sit on the left, the author links to the personal website in the center, and Principles on the right opens JEV directly; the old tagline and Support link are removed. All footer links have thin underlines, with smaller horizontal insets placing the outer links closer to the page edges.
- The workspace and introductions share the candidate composer and planning-project styles. The add button stays centered and contained; projects use equal project-colored borders on all four sides with no left stripe.

## 2026-10-04 · Product feature pages

### Improved
- Introductions use Times New Roman, equally enlarged headings, and an opening scroll cue. Today's Candidates uses task typography and a more generous width, with the timeline aligned right and regular project names. Dates are read-only; date and calendar-view switches, Back to now, and floating Add/AI shortcuts are removed, while task scheduling and completion remain available.
- Planning and Execute introductions fill the window with the product workspace: Planning has clearer indentation, compact task cards, and notes on the right; Execute keeps candidates on the left and the timeline on the right. Notes scroll naturally; each subsequent paragraph pauses briefly at the visual center, becoming smaller, fainter, and slightly blurred only near the top and bottom edges. Narrower desktop windows keep the notes visible; portrait versions of all three introductions show only text, navigation, and expandable FAQ answers, without loading interactive product workspaces. Landscape screens retain product previews. Planning and Execute use one page scroll: read the notes before the content below, with stationary interactive panels and a timeline fitted to the example day. Planning starts with website and learning expanded and exercise collapsed. Project blocks use project-colored outlines without left stripes, and right-side notes have tighter insets and a consistent width. All four matrix quadrants retain examples and equal heights. The candidate add button stays inside its container. Execute notes are centered with equal horizontal spacing. All three introductions add FAQ questions with thin plus disclosures and share five navigation items: Execute, Planning, Navo AI, Principles, and Support. Language switch tracks and thumbs use matching round corners. Example changes stay separate from personal data.
- Planning and Execute reuse the product header to switch between Execute, Planning, and Navo AI, with the logo returning home; Support includes Afdian, GitHub, and a personal-site placeholder, alongside a Principles placeholder. The homepage stays unchanged. Navo AI uses the native layout with Today’s Candidates on the left and the timeline on the right. A large cue points to the existing scheduling icon at the top right of Today’s Candidates. The short wait explains task estimates, breaks and reversible adjustments before moving six candidates onto the timeline, including lunch/rest and lesson notes at 15:30. Reschedule and Undo appear after arranging, gradually introducing preset operations without free-form input or real AI requests.

### Fixed
- Remove the legacy event from execution examples and combine small tasks into longer blocks, making room for lunch and rest, using adjacent schedules and occasional short breaks, and keeping free slots for visitors to try scheduling.
- Prevent hover previews from interrupting the first scheduling click; applying and adjusting AI suggestions uses timeline records, avoids existing schedules, and supports undo.
- Keep AI suggestions and action buttons visible on phones, with workspace navigation clear of open panels.
- Restored ChatGPT OAuth connections to NavoPath MCP and authorization page loading; existing personal tokens remain compatible.

## 2026-10-03 · Timeline position stability

### Added
- Added bilingual Planning, Execute, and AI feature pages with interactive example tasks showing the path from goals to execution, accessible from the homepage Product menu.
- Product demonstrations support following the story, free exploration, reset, and applying or undoing schedule previews; example changes stay separate from your personal workspace.

### Fixed
- Preserve the timeline scroll position and visible date across repeated switches between Planning and Execute in daily, three-day, and weekly views, with cross-day scrolling enabled or disabled.

## 2026-09-30 · Sync setup guidance

### Improved
- Sync now shows the two-way path between the account, phone, and cloud folder mirror before setup instructions, collapses first-time setup when a bridge is connected, and explains hidden token input, common setup failures, and where to check cloud uploads.

### Fixed
- Fixed task priority checkbox colors across Candidates, Schedule, and Planning; the priority menu updates the task priority directly.
- Reopening the workspace on a phone now checks the account's current cloud version before updating overdue tasks, and manual sync reads the latest cloud data before saving, preventing stale cached Today and Planning tasks from restoring desktop deletions.
- Keep quick add in the bottom-right floating control on Execute and Today’s Candidates, and make task editing fit and scroll within the phone’s dynamic viewport.
- When the timeline is away from the present, move “Back to now” to the far right of All Day and strengthen its label. Clicking it smoothly returns to the current time and briefly highlights the time line in portrait and landscape. Refresh now aligns the portrait time line precisely to one third of the viewport.
- Align the portrait return button vertically with the All Day label. Pause continuous day-window shifts during a return and correct the position after smooth scrolling so one tap lands on today's current time.
- Place the Planning filter in the top toolbar clear of the safe area; render Execute quick add in a viewport layer above the dock with safe spacing.
- Put account details inside the scrollable Settings home and hide the workspace dock there. Name changes now wait for persistence; a failed save keeps the editor open and offers a retry.
- Remove borders from Planning project actions, strengthen their icons, and align the filter with the Planning top bar.

## 2026-09-29 · Portrait controls and cloud folder sync

### Added
- Calendar & Integrations now includes Sync: copy an Agent setup prompt to connect an always-on computer with your own cloud folder, monitor its status, or follow the manual backup guide.

### Fixed
- Workspace revision conflicts now return HTTP 409, preventing repeated database retries from exhausting the API connection pool.
- MCP token checks now return a retryable 503 when the cloud service is unavailable instead of incorrectly reporting an invalid token.
- On portrait screens, refresh and “Back to now” align the target time at one third of the full viewport height.
- The Planning filter stays at the top right clear of the safe area; task-card action buttons lose their borders while keeping a visible keyboard focus indicator.
- “Back to now” uses a restrained borderless icon with a 44 px touch target.
- Restored task-priority cues on checkboxes: black for unset, blue with a faint blue fill for low, orange for medium, and red for high; checkbox outlines remain square when the browser is zoomed.

## 2026-09-28 · Mobile navigation and sync fixes

### Fixed
- Moved the mobile workspace dock outside the transformed app shell and fixed it to the viewport edge; Execute and Planning share one positioning rule, with the safe area handled inside the dock.
- Supabase JWT 401 responses trigger a session refresh and retry; workspace cloud reads and writes are capped at 15 seconds, with a sign-in prompt if the token remains rejected.
- Manual sync continues if the page moves to the background, and identical last-synced timestamps no longer appear twice.
- Same-project candidate dragging keeps the list still and shows a placement-direction hint below the dragged task; cross-project dragging marks the target project with a complete fine frame and aligns the assignment hint with the right edge of its project-color stripe. The extra translucent frame below the dragged task is removed, the source slot has no visible box, action buttons remain borderless, and the checkbox stays vertically centered.
- On portrait phones, task quick-add moves into the top toolbar so it no longer covers tasks; Schedule keeps its plus button with more clearance above the dock. The guide demonstrates holding a task, switching to Schedule, and placing it, with reduced-motion and remembered-dismissal support; date and view controls grow to 44px.
- On portrait touch screens, long-pressing ordinary text no longer selects it; inputs and editable regions remain selectable.
- On portrait touch screens, the Planning filter clears the top safe area; both docks now sit outside the transformed app shell and use the same viewport-edge rule, and Execute schedule checkboxes use a smaller visible square while keeping a 44px touch target.

## 2026-09-27 · 今日候选控件微调

### 改进
- 移除今日候选任务右侧按钮、执行/规划切换和时间范围切换的描边；子任务尚未完成时隐藏进度计数，并放大 Add 按钮。
- 在今日候选与规划的含子任务任务块底部加入可点击的进度栏，显示已完成数和总数，并提供展开/收起悬停提示。

## 2026-09-26 · UI 圆角、任务编辑与时间轴状态

### 改进
- 将任务编辑页的“转换为”移到备注下方；悬停“未完成”可分别选择任务是否继续、是否回到 Planning，并用时间轴叉号区分已经跳过的安排。
- 将任务块、UI 边框、按钮和弹层统一为 squircle 圆角；编辑页并排操作按钮统一为完整描边。
- 根据反馈保留浅色模式的执行页布局与候选分组，在深色模式恢复轻微交错的时间轴时段纹理和项目色标记；将近白色交互高亮与明亮描边改为柔和石色，移除荧光感。浅色强调色设置继续保留。
- 深色与浅色共用宽屏执行页工作区结构、候选浮层层级和缩放手柄，颜色通过主题 token 区分。
- 移除已停用的 Neumorphic 主题样式、永久隐藏的旧执行顶部栏及重复控件，减少样式表和执行页组件体积。
- 今日候选快速添加按钮改为 Add，加粗放大并响应手形悬停；浅色使用白底黑字、深色使用黑底白字，禁用时保留填充并明确显示禁用状态。
- 禁用的快速添加按钮在悬停和按下时保持静止，避免产生仍可操作的动效反馈。
- 深色模式左上角产品图标使用反色并保留原有明暗细节，避免变成整块纯白；快速添加 ADD 按钮加宽并采用与界面一致的 squircle 圆角。
- 执行工作区改为按横竖屏切换布局，统一时间轴外围底板颜色并保留交错时段纹理。
  - 移除窄横屏的额外双栏状态；宽度不超过 980px 时使用紧凑单面板，981px 起切换到完整双栏。
  - 深色与浅色模式共用候选栏宽度，避免横屏比例下深色模式挤窄任务内容。

### 修复
- AI 处理失败时显示请求编号，便于定位对应服务日志。
- 更新 DOCX、PDF 和构建工具依赖，修复安全公告中列出的漏洞。
- 外部日历刷新改为事务替换，刷新失败时保留现有事件；首次同步失败会清理未完成的日历来源。
- MCP 新建任务不再自动设置截止日期；排程与其他任务共用冲突校验，并正确处理跨日结束时间。
- iOS 定位权限会说明用途；移动端页面恢复浏览器缩放支持。
- 网页立即同步会在网络短暂中断或云端网关异常时有限重试；仍失败时明确显示失败状态并继续后台重试。
- 修复竖屏规划视图将滑动误判为任务拖动的问题，拖动前需先长按；iOS 主屏幕模式的工作区底栏避开安全区；习惯勾选按钮固定为 44px 方形，内部勾选框保持 18px。
- 修复窄屏规划页被过高的最小高度裁切，四种任务视图可在可见区域内滚动；习惯勾选框的方形样式也适用于桌面浏览器模拟竖屏。
- 竖屏时间分配图改为上方显示总时长或选中项目的名称与时长、圆环中心固定显示总时长、下方用颜色圆点标示各项目；点击扇区或图例可切换项目，底部内容可滚动到导航栏上方。
- 重新绘制规划页五种视图的图标，用分支、分栏、四象限、勾选列表和圆环表示各自功能；竖屏切换栏仅显示图标，并保留读屏名称与 44px 点击区域。
- 关闭规划说明或今日候选的拖拽提示后会在当前设备记住选择；修正提示关闭图标被示意图样式拉伸，并将底线式操作按钮改为完整细描边，清理旧的下划线规则。

## 2026-09-25 · 任务与子任务体验改进

### 修复
- 修复任务编辑页的 AI 子任务拆解：使用专用生成流程，将有效结果直接追加到当前任务并保留已有子任务。
- 修复今日候选中勾选子任务会误切换父任务的问题；展开子任务时父卡片会按内容扩展，避免与下方任务和习惯区重叠。

### 改进
- 为 AI 子任务生成加入动态反馈和逐项显现效果；收紧规划树子任务缩进，并让编辑页保留所有子任务的同时统一复选框样式。
- 重新设计子任务展开控件，移除描边并保留清晰的交互反馈。

## 2026-09-24 · AI 响应稳定性

### 修复
- 延长全局 AI 等待时间，避免较慢的模型响应被提前中断。

## 2026-09-23 · 习惯详情改进

### 改进
- 更新日志页面补齐历史中英文记录，并新增可滚动的右侧目录；窄屏下目录收进可展开列表。
- 习惯详情支持直接勾选每个应检查日期，并将完成控件改为方框；新习惯默认时长为 15 分钟，类型切换与启用开关在缩放时保持清晰稳定。
- 习惯总览与编辑页统一为方框日期格和横向滚动；编辑页默认完整显示 7 天、将今天排在第二位，日期范围会随滚动更新，点击范围可用月份选择器快速跳转。
- 习惯新增 Start From（默认习惯创建日期）和可选 Till；范围外的日期在完成情况和快速选择中置灰并禁用。网页缩放时收紧候选任务与习惯勾选区留白，并将候选任务时长与“安排”“更多”并排。
- 整理详情操作区，将返回与保存并排放置，并把归档和二次确认的永久删除收进更多菜单。
- 周进度日期栏可无限向前后横向滚动，滚动到边缘会自动延展；点击“今天”会平滑定位并短暂高亮。习惯类型选择和星期选择去除多余卡框，增强选中、悬停反馈并保持右对齐。
- 横屏缩放时，候选任务标题保留足够阅读宽度，时长信息移到下一行；日历勾选控件保持方正，视图切换标签不再折行。
- 普通与逾期候选任务均可在安排入口悬停约 300 毫秒后预览建议时段，并从右侧“定位/返回”平滑聚焦时间轴或恢复原位置；未定位的预览在指针离开任务卡后收起。

### 修复
- 浏览器缩放不再把设置开关拉高变形；习惯启用开关改用统一的中性色设置开关样式。
- 刷新后时间轴将当前时刻定位在视口上方约三分之一处；工作区数据更新时会保留当前时间轴滚动位置。

## 2026-09-22 · MCP 连接整理

### 改进
- MCP 设置改为“生成专用令牌、复制给 Agent”的两步连接流程；手动端点配置与有效令牌分别收起和归组，减少首屏信息干扰。
- 竖屏设置详情移除重复的分类下拉列表，基础信息直接上移；返回设置主页后仍可切换其他设置分区。

### 修复
- MCP 令牌读取、生成与撤销会自动恢复数据库 schema cache 的瞬时失步，并在部署时主动刷新缓存，避免生成操作直接失败。

## 2026-09-21 · 时间轴视图内建议

### 改进
- 新增 TypeSafe 官方 Jev API 作为任务用时与项目归类的首选预测通道；密钥保存在 Supabase 服务端，未配置或调用失败时继续使用 OpenRouter、Vercel Jev 与 DeepSeek 降级。
- 时间轴预览激活时，候选任务会同步显示建议日期与时间，并提供手动“定位”入口，避免建议落在当前滚动视口之外时看起来像没有响应。
- 登录弹窗按参考布局整理为衬线标题与更紧凑的表单，移除主题选择并默认使用浅色；密码栏右侧提供可访问的显示按钮，登录时“保存密码”与“忘记密码”左右排列，注册时要求两次输入密码、同样提供“保存密码”，并在服务端允许即时会话时注册后直接进入工作区。“保存密码”勾选后安全保留登录会话，未勾选时只在当前窗口有效。
- 登录时优先展示当前账号的干净本机快照，并在后台核对云端版本；注册初始化的档案会被首次工作区加载复用，减少重复读取。
- MCP 设置新增可安装的 NavoPath 日程 Skill 与“复制给 Agent”提示词；生成专用令牌后，提示词会自动带入 Skill 下载地址、当前账户端点与 Token，便于 Agent 完成连接并按 15 分钟网格安全添加日程。

### 修复
- 识别 TypeSafe、OpenRouter 等 Jev 返回的不同模型版本格式，并缓存低置信度预测结果，避免悬停时为同一任务反复请求。
- Jev 候选建议严格限制在当前日、三日或周视图覆盖的日期内；切换视图时保留画面中心对应的日期与时间，当前范围无空档时明确提示，不再跳到截止日期或未来日期。
- 逾期或退回候选区的未完成任务在悬停时始终显示上次实际安排的日期时间，建议时间只出现在时间轴预览中。

## 2026-09-20 · 今日候选快捷安排

### 改进
- 今日候选按项目呈现更清晰的分组标题，并为每组加入快捷添加与整组智能安排；快捷添加会预选项目并聚焦输入框，整组安排继续复用现有可确认的批量排程流程。
- 候选任务的时长、安排日期、优先级与归属项目统一使用可滚动的悬浮短列表；点击其他区域或按 Escape 会自动收起，并在桌面与窄屏保持正确图层。
- 普通任务会按当前日、三日或周时间轴生成 Jev 建议落点；时间轴预览默认显示 N 标志，悬停后切换为确认安排提示，点击即可沿用现有排程保存流程。
- 任务更多操作收敛为移回规划、设置优先级、归属项目和二次确认删除；重复设置及周期选项现已完整适配中英文。

### 修复
- 逾期或从时间轴退回的未完成任务会保留并显示原排程日期时间；悬停时切换为当前时间轴视角下的建议安排时间，点击后展开完整安排选项。
- 页面刷新后时间轴只在首次加载时对焦当前时刻；悬停安排建议、切换候选任务操作及确认快捷日期会保留用户当前的时间轴位置。
- 逾期时间展开区改为“显示到时间轴、未完成、取消安排、四个快捷日期、更多”的紧凑操作布局，并加入轻量展开动画与减少动态效果适配。
- 项目分组标题不再显示任务数量；安排面板按钮略微收紧高度，底部“更多”按钮改为与其余操作区域等宽。
- 悬停逾期或退回候选区的未完成任务时，卡片始终保留上次实际安排的日期时间；Jev 建议时间仅显示在时间轴预览中。
- 候选任务的 Jev 建议严格限制在当前日、三日或周视图覆盖的日期内；当前视图没有可用空档时会明确提示，不再静默跳到截止日期或未来两周中的日期。
- 切换日、三日和周视图时会保留当前画面中心对应的日期与时间，避免复用旧滚动像素后把视图错误映射到更早日期，并确保后续建议读取真实可见范围。

## 2026-09-19 · 快速任务预测

### 改进
- Obsidian Bridge 支持按行配置多个知识目录白名单，默认同时连接升学资料与 NavoPath 产品笔记；旧版单目录设置会自动迁移，并继续只发送增量元数据与有限的日程片段。
- 创建任务时会先用本地历史立即估算用时与项目，再由服务端 Jev 在后台校准；点击“安排到时间轴”会先显示即时落点，并在预测返回后安全更新尚未确认的预览。
- 用时与项目分别采用独立置信度：高置信度项目可自动归属，中等置信度只显示建议；用户修改、已确认排程和关闭自动预测设置始终优先。Vercel AI Gateway 密钥仅保存在 Supabase 服务端，缺少密钥或网关异常时继续使用原有降级路径。
- Jev 新增 OpenRouter Decisions API 通道，优先使用支付宝可充值的 OpenRouter 额度，并继续保留 Vercel Jev 与 DeepSeek 降级；请求默认拒绝提供商采集任务内容。

### 修复
- 移除 Jev 请求状态中的空可选字段，避免新任务缺少历史信息时触发网关参数校验并降级到通用模型。
- 修复任务估时并自动归入项目后，底部提示中的“撤销归属”操作被全局按钮样式覆盖成空白方框的问题。

## 2026-09-18 · AI 设置与网页通知

### 改进
- AI 提供商设置改为上方说明、下方横向表单，充分利用横屏空间；界面中的智谱名称统一为 GLM。新账号首次登录网页端后会请求开启通知，浏览器需要额外手势时会在进入工作区后的第一次操作中触发。
- AI 侧栏模式会记住用户选择，关闭后再次打开仍保持停靠；三日与周视图的纸面背景、小时色带和分割线现已与日视图统一。
- 首页的 Execute 与 Planning 产品预览均更新为高清真实工作区截图，以工作、学习和日常生活组成完整的一天；中英文主文案与界面示例同步切换，并使用新图片地址避免旧图缓存。产品主图现与网页同宽，下方执行、规划与行动文案改为从上到下的单列信息流，主行动按钮改为“直接开始”。Planning 与设置页统一为时间轴的中性纸面背景，Planning 任务卡移除“已加入今日候选”副标题并让标题竖直居中。
- 设置分类、设置内页标签与 Planning 视图切换统一采用整行圆角选中态，替换旧的底边半包样式；通知中心、全局搜索及后续浅色界面统一继承时间轴的中性纸面底色，避免出现泛紫表面。
- 降低网页端同步造成的卡顿与掉线：线上网页停止建立不稳定的跨域 Realtime WebSocket，改用切回页面时立即检查、前台每 30 秒轻量检查版本；连续编辑合并为 750 毫秒后保存，减少整份工作区的重复上传与重连压力。

## 2026-09-17 · 设置页布局与 AI 侧栏

### 改进
- Navo AI 停靠到右侧栏时，Execute 工作区会以平滑动画为侧栏腾出空间；日、三日、周、月时间轴均随可用宽度自适应，内容不再被侧栏遮挡。
- 横屏网页版设置现在直接打开左侧分类、右侧详情的双栏界面；竖屏继续使用带快速设置与分类入口的设置首页。

### 修复
- 修复桌面端设置详情的分类栏与内容区相互重叠、页面被挤成窄列的问题；手机端仍保持清晰的上下分区布局。

## 2026-09-16 · Navo AI 侧栏

### 改进
- Navo AI 标题栏新增侧栏停靠按钮，可在可拖动浮窗与贴右侧栏之间快速切换；窄屏继续使用原有底部面板。

## 2026-09-13 · 候选任务拖动修复

### 修复
- 修复今日候选拖动后顺序跳动、意外改变项目归属的问题，稳定落点预览与松手位置；按项目分类时仅在同组内排序，取消分类后可跨项目排序并保留原有归属。

## 2026-09-12 · 工作区精简与设置改进

### 改进
- 顶栏移除同步按钮，手动同步、上传与下载集中保留在设置的账户与数据分区；横屏通知保持原有右上浮层位置。
- 修复深色主题下任务、习惯与规划区域的纸面背景及竖屏导航文字对比度。
- 收紧竖屏规划页的顶部留白、项目间距和任务缩进，候选任务行减少常驻操作，为标题保留更多宽度；保留完整触控区域。
- 候选区常驻工具收敛为 AI 安排与更多图标，并提供悬停提示；分组、完成项、专注和模板等在更多菜单中展开。规划任务仅保留一次候选状态，任务详情将重复、复制、删除与类型转换收进更多，手机短栏可打开完整详情。
- 设置首页支持点击头像上传或替换图片，用户名旁的编辑入口可打开显示名称编辑区；强调色改为右侧当前值与上下箭头触发的展开选择，并在手机与桌面保持完整显示。
- 设置首页补回通知入口，打开通知前会先关闭设置面板；强调色选择器显示颜色名称并使用真实色点，补齐浅色黑色与深色白色的中性选项。
- 通知入口现在紧跟个人资料；竖屏通知中心改为占据下半屏的底部短栏，横屏继续使用原有浮层。进入设置分区后隐藏头像资料，标题移到顶栏并提供返回设置首页的入口，用户名编辑改为首页内联保存，避免头像和名称被旧数据回写覆盖。

## 2026-09-11 · 窄屏 Execute 工作区

### 修复
- 修复 760px 以下横向窗口的 Execute 布局：候选区与过窄时间轴不会同时挤在屏幕内，改用完整时间轴和移动操作栏；底部 Dock 为时间内容预留空间，AI 与快速添加入口保持在可视区域内。
- 修复竖屏与窄屏工作区的底栏对齐和 Planning 内容遮挡问题；底栏设置入口直接显示用户头像，设置页采用更清晰的分组列表结构。通知与设置共用头像入口，移除 Focus Mode 设置与强调色恢复按钮，强调色改为统一色板并同步作用于 Execute 与 Planning。
- 设置入口现在默认打开 ChatGPT 风格的设置首页：主题、强调色和语言可快速调整，其余选项通过带说明的分区入口展开；移除设置搜索，并恢复桌面与竖屏开关的稳定尺寸和轨道样式。
- 设置首页的头像现在可直接点击上传或替换图片，用户名旁提供编辑入口；强调色改为右侧当前值与上下箭头触发的展开色板，手机和桌面均保持完整可用。

## 2026-09-10 · Execute 时间轴与快捷操作

### 改进
- 修正 Execute 时间轴底部留白，让时间画布填满可用区域并与候选区纸面背景自然衔接；快速添加改为居中的小型上箭头，右下角添加与 Navo AI 入口在桌面端保持可见。
- 放大顶栏同步、搜索、通知和设置图标，品牌标志保持无边框且禁用时不再显示禁止手势。
- 修复中等横向窗口的工作台断点：候选区保留悬浮纸面和可读宽度，时间轴填满右侧，勾选框保持独立的触控区域与小型视觉控件，底部入口不再错位或遮挡内容。
- 顶栏、移动 Dock、模板操作和桌面小组件统一复用同一套图标组件，保持图标尺寸、语义标签和交互状态一致。
- 降低云端主动助理的 Queue 用量：分钟级通知检查改为直接运行，任务开始提醒继续保持及时，晨间简报、晚间复盘、空档检查和工作区事件仍按需排队处理。
- 任务排程现在严格使用时间轴的 15 分钟刻度：AI、MCP 和 Agent 都只接受 `:00`、`:15`、`:30`、`:45` 的开始时间及 15 分钟倍数时长；主动提醒改为在 `14/29/44/59` 分执行，并保留整点与半点的空档和简报检查。

## 2026-09-09 · 主动通知与每日 AI 助理

### 改进
- 快捷键 `N` 与桌面添加按钮统一打开新的任务详情页，并移除旧的任务快速添加表单入口。
- 设置页改为通用、外观、工作流、账户与数据、Navo AI、桌面窗口（桌面端）和日历与集成七个清晰分区；点缀色、账户操作与恢复设置直接展开，并移除三个不再需要的子设置。
- 云端每分钟扫描时间轴，在任务开始前 1 分钟提醒；工作时间内至少 1 小时的空档提醒补记；工作结束时聚合未完成任务并提供逐项完成、移至明日候选或交给 Navo AI 安排。
- 通知中心的消息关闭叉仅在悬停对应提醒时出现，使用更浅的灰色无边框样式；右上角总关闭叉放大并保持无边框，移动端仍保留可操作的触控区域。
- 工作日开始按工作时间生成开工简报并按邮件开关发送；工作…55479 tokens truncated…t — the internal top is used only when `extraStyle` does not supply one — so continuous mode still defers to `continuousTimedTop` while non-continuous mode restores the correct within-day offset.
- Rebuilt the Metrics donut outside annotations as a compact two-segment leader + side-label system where every project shows a permanent external label: a short radial tick from the arc edge (outer+34 elbow) joins a 42px horizontal segment, with the project name beside the line end (start anchor on the right, end anchor on the left) at 12px/600, leader stroke 1.5px at 22% semi-transparent gray (36% when active) — a quiet data-chart annotation style. Project names are standing annotations, not hover tooltips: every project in the donut (including small slices like "Daily" and "Essays") gets a default external label, with no ">=6% or top 5 only" filtering and no hover-only surfacing. Same-side labels get a single Y sort-and-push collision pass (minGap 20px); if the lane overflows the safe band the whole lane shifts up and clamps back inside, so all labels stay visible — none are hidden and none spill to the edge. Removed the "Top focus" item from the right-side metrics summary (it duplicated the donut and project list), keeping only Planned, Unplanned, Tasks, and Done; removed the colored dot from the donut center hover state, keeping just the project name, duration, and percentage. On hover only the active segment's outer radius expands, the center text swaps, and the current label/leader brighten slightly — other labels never disappear or reshuffle.

### Improvements
- Rebuilt "Template mode" as a template version of the execution timeline: the "Schedule Template" button in the Today's Candidates top bar no longer opens a table editor — it opens a two-pane editor with a template list on the left and a template timeline on the right. The left list shows Default 1 / Default 2 / custom templates plus "+ New template"; each row shows the template name, period count, and time span (e.g. `8 blocks · 08:00–17:20`), and supports select, inline rename, duplicate, and delete. The right timeline renders the execution-page 15-minute slot grid: click blank to create a period, drag a block to move it, drag its top/bottom edges to resize, click a block to edit its title, delete via the top-right button. Periods only store `{title, startMinutes, durationMinutes}` and never touch the real task store; clicking "Apply to today" writes the non-conflicting periods into the selected date's timeline (conflicting periods are skipped by default with a conflict count surfaced). The old "Add today" checkbox column, "Daily goal" column, "Add period", "Reset current" toolbar buttons, and the spreadsheet-style slot editor have been removed, along with the residual styling for the legacy table and list/timeline UI. The `ScheduleTemplate` / `ScheduleTemplateSlot` data shape and the `applyTemplateToDate` flow are unchanged, so previously saved templates remain reusable. The template modal and the execution page now share the SAME real React components (not just CSS classes): six shared components are extracted — `ExecutionLayoutShell` (the `<main class="df-execute">` grid), `CandidatePanelShell` (`<section class="df-candidate-panel">`), `CandidatePanelHeader` (`<div class="df-panel-title">`), `CandidateBlock` (a list-row primitive built on `TaskBlock variant="candidate"`), `TimelineCanvas` (the `df-timeline-scroll` + `df-timeline-canvas` scroll container), and `TimelineEventBlock` (a scheduled-block primitive built on `TaskBlock variant="scheduled"` with resize dots / body / delete) — and both the execution page and the template modal render these components directly. The execution page's daily timeline no longer inlines `df-timeline-scroll`/`df-timeline-canvas` JSX; it calls `<TimelineCanvas>` exactly like the template modal. Template list items no longer use a custom `df-candidate-task-row`; they are `<CandidateBlock mode="template">`. Template period blocks no longer inline a `TaskBlock` wrapper; they are `<TimelineEventBlock mode="template">`. Column widths, gap, borders, scroll behavior, and paper background are all decided by the shared components — no template-specific left/right layout CSS remains (`df-template-split` / `df-template-candidate` / `df-template-timeline-panel` and the giant title region have been deleted). The template name now appears only as a compact name bar at the top of the timeline panel, with no standalone large title or description text. A `TimelineAdapter<T>` interface and a `templatePeriodAdapter` implementation isolate template-period draft data from the real task store, so template edits never pollute today's tasks and real scheduled tasks are only created on Apply; template drag/resize keeps its own `beginPeriodDrag` (operating on drafts, not real tasks), isolated from the execution page's `beginBlockDrag` via the adapter contract — an intentional data boundary, not a missed reuse.
- Added a desktop always-on-top widget: a real Electron `BrowserWindow` (`alwaysOnTop`, `frame`, draggable, resizable, remembers position) that renders a standalone `WidgetApp` via the `?widget=1` route instead of the full App, so it does not boot Supabase auth/data loading. The widget is a pure IPC client — it holds no task data; all state is owned by the main window's React store and synced via an IPC relay. The widget sends actions (quick add, timer start/pause/resume/save, complete, toggle always-on-top, reset position) through the main process to the main window for execution; the main window pushes a `WidgetSnapshot` (current task, timer, candidate count, language, always-on-top setting) back to the widget. The widget ticks its display locally every second and reconciles on each incoming snapshot. The entry point is an icon button in the candidate panel header (visible only on desktop and when the feature toggle is on); Settings > Features adds three toggles — "Enable desktop widget", "Widget always on top", and "Open on launch". Quick add defaults to no project and adds to today's candidates, sharing the same store as the main window with no independent fake data. The visual style is NavoPath paper-like (warm white background, thin border, restrained shadow, compact buttons), with no dashboard or glow feel. Mobile and web-only environments do not show the entry.
- Added an "All" time range option to the Metrics view, so project time allocation and task completion can be measured across all time instead of being limited to today/yesterday/this week/last week/this month/custom; the `MetricRangePreset` type and corresponding date-range calculation were updated accordingly.
- Extracted the six layout components shared between the template modal and the execution page into a standalone module `src/components/ExecutionSharedLayout.tsx`, enforcing reuse via real ES-module `import` statements rather than same-file scope: line 54 of `src/main.tsx` reads `import { ExecutionSplitLayout, CandidatePanelShell, CandidatePanelHeader, CandidateBlock, TimelineCanvas, TimelineEventBlock } from "./components/ExecutionSharedLayout"`, and both the execution page `App` and `ScheduleTemplateModal` reference the same imported bindings. The six local functions that previously lived at the bottom of `main.tsx` (formerly named `ExecutionLayoutShell`, etc.) have been removed; `ExecutionLayoutShell` was renamed to `ExecutionSplitLayout` at the same time. Each shared component renders a `data-reuse` attribute (`execution-split-layout` / `candidate-panel-shell` / `candidate-panel-header` / `timeline-canvas` / `timeline-event-block`) so opening the template modal and inspecting the DOM confirms the reused components are actually on the tree. Template drag/resize keeps its own `beginPeriodDrag` (operating on drafts, not real tasks), isolated from the execution page's `beginBlockDrag` via the `TimelineAdapter<T>` contract — an intentional data boundary, not a missed reuse.
- Completed the Visual Parity fix between the template modal and the execution page: deleted the template-specific timeline grid CSS overrides (`.df-template-shell .df-slot`, `.df-template-shell .df-timeline-canvas`) so the template timeline uses the execution page's global CSS directly — the hour grid comes from the `repeating-linear-gradient` background on `.df-timeline-canvas`, hour labels sit in the left gutter (`.df-slot span { left: -56px }`, the scroll container's `padding-left: 56px`), and the canvas border comes from the global `border-left`. The template timeline now renders all 96 slots (hour + quarter + major), matching the execution page's daily timeline slot structure exactly, instead of only 25 hour slots. Template period block positioning changed from `left: 56px` to `left: 8px` (matching the execution page's `baseLeft`), so blocks sit in the content area instead of avoiding in-canvas labels. The template modal frame (`.df-template-modal`) only provides overlay, close button, and footer action bar; the body layout is fully owned by `<ExecutionSplitLayout>` — column widths, gap, borders, scroll behavior, and paper background all come from the shared component, the modal frame no longer controls the left/right split.

## 2026-07-06 · Habit overview refactor & feature toggle

### Fixes
- Fixed the timeline jumping, inaccurate drop position, and vertical shift when dragging a task from Today's Candidates into the timeline: candidate→timeline drag was still using the single-day `getDropTargetFromPointer`, which under infinite cross-day scrolling inferred the date from the X column and clamped the time to the first day of the canvas, sending the preview and final schedule to the wrong date/time; it also kept rewriting `scrollTop` whenever the pointer crossed the timeline edges, causing vertical drift. The drag now uses the same `resolveDropTarget` as timeline event drag (date-from-Y-band in continuous mode) and the auto-scroll during candidate drag has been removed, so the timeline position and current date are never rewritten during the drag and the drop target and preview follow the pointer exactly. Timeline event drag/resize itself is unaffected.
- Fixed the "now" line disappearing from the 3-day/week timeline when infinite cross-day scrolling was disabled: the multi-day `NowLine` was not receiving `dayStartHour`, so in non-continuous mode it fell back to computing the vertical position from midnight instead of the configured day-start hour, shifting the line out of the visible scroll area when a non-zero day-start time was set. The correct `dayStartHour` is now passed, and an additional guard checks whether today is inside the rendered date range before rendering, so the now-line appears in both continuous and non-continuous modes whenever today is visible.
- Fixed continuous cross-day timeline scrolling across day, 3-day, and week views: the timeline can scroll upward into previous dates and downward into following dates without forced date switches or page-like snapping. Header dates now follow the visible timeline window, cross-day boundaries use `0:00` instead of `24:00`, and Back to now appears after cross-day scrolling away from today and recenters the current time.
- Fixed timeline task drag and resize breaking after infinite cross-day scrolling was enabled: drag/resize now use continuous absolute-minute coordinates (pointer Y + current canvas geometry → date + time) instead of inferring the date from the single-day X column. Dragging across midnight (e.g. 23:30 → next day 00:30) correctly switches to the next day while preserving the original duration; resizing the bottom edge across midnight (23:30/30m → next day 00:30) yields a 60m duration instead of breaking. Short tasks (15m/30m) still render at their original pixel height, and title/project/completion stay unchanged throughout drag and resize.
- Fixed the donut chart hover effect in the Metrics allocation view: hovering a segment previously used `translate` to shift the whole segment outward, which moved both the inner and outer edges and distorted the center hole. The hover now only expands the outer radius (88 → 94) while keeping the inner radius unchanged, so the center hole size stays fixed and the segment grows outward instead of scaling or translating.
- Fixed the Metrics donut hover hit area being too large, leader lines being too flat, project names being mispositioned, and center text being off-center: the hit area changed from `bounding-box` (the whole segment bounding box, including the center hole and outside whitespace) to `visiblePainted` (only the filled arc itself triggers hover); leader lines and labels are set to `pointer-events: none`; `onMouseEnter`/`onMouseLeave` are bound only to the arc path, never to the svg/g/container; the SVG viewBox is now symmetric around the donut center (`-70 0 380 240`) so the center text aligns exactly with the donut's geometric center; the leader line's radial segment was lengthened (elbow radius 108 → 128) and the project name is placed above the horizontal segment.
- Fixed the Metrics donut showing a native black tooltip on hover, the project name not hugging the leader line closely enough, and the radial segment still being too flat: removed the `<title>` element from the segment path so no browser-native tooltip appears — hover now only expands the outer radius and swaps the center text; increased the leader line elbow radius from 128 to 148 and shortened the horizontal distance from 165 to 158 so the diagonal segment is more pronounced and the bend is clearer; the project name now sits tightly above the horizontal segment (y offset reduced from -4 to -2, dominantBaseline set to alphabetic) like annotation text hugging the leader line.
- Fixed the Metrics donut outside project name being mispositioned at the end of the horizontal leader segment: the label was previously anchored at the p2 endpoint of the horizontal segment, so it looked like a tag stuck to the left/right end of the line rather than annotation sitting above the line. The label is now anchored at the midpoint of the horizontal segment (between p1/elbow and p2/end) with `text-anchor: middle`, so both left- and right-side project names are centered strictly above the horizontal segment like annotation text sitting on top of the line, no longer drifting to the line's outer endpoint.
- Refined the Metrics donut outside annotation: the project name vertical position is now fixed at 8px above the horizontal segment (`labelY = p1.y - 8`) for a stable breathing distance from the line, no longer hugging or drifting; the outside leader line stroke was thickened from 1px to 1.5px while keeping the same soft neutral gray (80% paper-rule color), so the line reads more clearly and steadily without becoming heavy, preserving NavoPath's quiet paper aesthetic.
- Rebuilt the Metrics donut hover detection as a layered structure: separated the visual ring from the hit layer — added a transparent pie-sector hit layer (`pieSectorPath`, innerRadius=0, outerRadius=96) where each project sector spans from the center to the outer edge, so the pointer hovering inside the center hole still activates the correct project by angle (right-center → right project, lower-left center → lower-left project, upper-left center → upper-left project); the visual arc layer, leader lines, labels, decorative ring, and center text are all set to `pointer-events: none` so events pass through to the hit layer; the hit layer outer edge does not exceed visual outer radius + 2px, so outside whitespace never triggers hover. Hovering still only expands the active segment's outer radius (88→94) while the inner radius stays unchanged.
- Fixed the Metrics donut cursor flickering between pointer and default on hover: the root cause was multiple SVG elements (visual arcs, hit sectors, leader lines, labels) each receiving pointer events, so the cursor switched rapidly as the pointer crossed element boundaries. Replaced with a single transparent hit disk (`<circle r=98>`) on top that handles all `onPointerMove` / `onPointerLeave` / `onClick`; every other SVG element is `pointer-events: none`. Hover is computed from the pointer's angle relative to center (`atan2 → polar angle → segment match`) rather than relying on multiple paths competing for events; the cursor is pointer only on the hit disk and default elsewhere, eliminating the jitter.
- Fixed the Metrics donut outside project name still being offset: the horizontal segment was only 10px long (elbow radius 148 vs labelDistance 158 — nearly equal), so the segment was too short and the label anchor still sat near the p2 endpoint. The horizontal length is now driven by the project name length (`horizontalLength = max(128, label.length * 16)`), with p1 fixed at `visualOuter + 52` and p2 at `p1.x ± horizontalLength`; the label is anchored at `(p1.x + p2.x) / 2`, `p1.y - 8`, `text-anchor: middle`, so both left- and right-side project names are centered strictly above the horizontal segment, with the line acting like an underline beneath the name.
- Refined the Metrics donut outside label typography and the right-side summary: reduced the outside project name font-size from 11px to 10px and font-weight from 600 to 500 so it no longer reads like a headline and returns to chart-annotation visual weight; tightened the horizontal length formula to `max(88, label.length * 13)` and adjusted labelY to `p1.y - 6` so the name sits closer above the horizontal segment; removed the "Top focus" item from the right-side metrics summary (it duplicated the donut and project list), keeping only Planned, Unplanned, Tasks, and Done with no empty placeholder left behind.

### Improvements
- Reworked the Metrics donut into a labeled ring chart: it remains a single donut where each colored segment represents one project; outside each segment a two-segment leader line (radial segment + horizontal segment) points to just the project name, placed above the horizontal segment — percentage and duration no longer appear beside the leader line; the center defaults to total scheduled duration + range label and switches to the hovered project's color dot, name, duration, and percentage on hover; the ranked list and tooltip still provide full duration / percentage / task count. Hovering a segment only expands its outer radius while the inner radius stays unchanged.
- Added a new Metrics view to Planning. It reports project time allocation from scheduled/planned timeline records, with today/yesterday/week/month/custom ranges, a project donut, ranked list, density heatmap, task drill-down, and Linear-style filters. Unplanned time is shown separately, habits are included by default, cross-day tasks are split by actual overlap, and day-start settings are respected.
- Rebuilt the Habits Overview panel: replaced the cluttered bordered-box grid with a structured week table — habit name column on the left, seven circular day-completion units on the right, with rows strictly aligned to the header for a clean paper-table feel.
- Split the top control bar into two groups: week range title (editorial display type) + today's completion stats on the left; previous / today / next / new-habit buttons on the right, no longer crammed together.
- Day column headers use a two-line layout (weekday + date); today's column is marked with a restrained accent tint.
- Upgraded the completion unit from a 9px dot to an 18px circle: empty ring when not done, light accent tint when planned, solid accent fill with a white check when done; subtle hover background, no exaggerated animation.
- The disabled-habits section is now a bottom collapsible bar (▸/▾ indicator); expanding it shows one row per habit with lightweight view/edit and restore icon actions, replacing the old oversized empty box.
- Habit duration is shown muted (small mono font) on the right of the habit name to keep visual hierarchy clear.
- Habit panel width increased from 520px to 560px so the eight-column table breathes; on narrow screens the table scrolls horizontally and column widths adapt.
- Added "Enable habit tracking" toggle in Settings > Features: when disabled, hides the habit section in the candidate list, hides the habit overview entry point, and prevents opening the habit panel; all habit data is preserved for when the feature is re-enabled.

## 2026-07-05 · Timeline short tasks & selector improvements

### Fixes
- Fixed short and tall timeline scheduled blocks stretching to the full-day canvas height: 15m/30m tasks and longer scheduled blocks now respect the timeline-calculated pixel height instead of inheriting `height: 100%` from the scheduled root style.
- Fixed selected-state persistence bug: form initialization used `??` operator which treated `null` (unset) as falsy and fell through to `priority ?? "high"`, causing "unset" state to be lost on drawer reopen. Changed to `!== undefined` check to preserve explicit `null`.
- Fixed selected-state CSS being overridden by global `.df-app button` `!important` rules: global button rules forced `border-color` / `box-shadow` on all buttons, overriding the selected state. Added `.df-level-option` to every global button rule's `:not()` exclusion list, and switched the selected state to an explicit `data-selected="true"` attribute selector with an inline `--option-color` CSS variable.
- Selected-state visual feedback now covers the entire segment: the selected segment uses a `::after` pseudo-element spanning the full button area (inset: 0) with a 2px semantic-color solid border and 6% semantic tint. First-child segments get 11px top-left/bottom-left corners, last-child segments get 11px top-right/bottom-right corners, and middle segments have no rounding — all matching the container's 12px outer radius. Pseudo-elements are NOT affected by global `.df-app button` `box-shadow: none !important` rules, completely solving the previous override issue.
- Fixed short-duration timeline task layout: 15m/30m short events no longer inherit full-size candidate task styles (min-height, large padding, large fonts). Short tasks (height < 56px) now render compactly with 14px checkbox, 12px single-line title (ellipsis when overflow), minimal padding, hidden metadata/actions, and vertically centered content.
- Fixed timeline drag/resize bug: After resizing a task, the task block becomes a huge blank area and the title shows "Duration Adjusted". Root cause: when resizing, only one of `scheduledStart` or `scheduledEnd` was updated, causing `taskDuration` to calculate incorrectly, which then produced wrong pixel heights via `timeBlockHeight`. Fix: update both time fields and `estimatedHours` together during resize to ensure data consistency.
- Fixed ultra-long timeline task rendering: Multi-hour tasks no longer have their title and checkbox floating in the vertical middle of a huge blank block; they now use top-aligned layout with content pinned near the top of the event block.

### Improvements
- Refactored the task drawer's "Importance / Urgency" controls from plain text buttons into a connected segmented icon strip sharing one outer border and rounded corners, with thin dividers between segments.
- Importance uses standard Lucide-style flag icons, urgency uses horizontal text exclamation marks, colors unified to muted NavoPath palette.
- Added an "unset" option; clicking it immediately clears the field.
- Matrix quadrant mapping keeps the high/non-high logic; no 3x3 matrix was introduced.
- Task card checkboxes now reflect importance via border color (high=coral #C96F5B, medium=amber #C49A32, low=muted blue #6E8DA6, unset=neutral ink); the semantic border color is retained after completion.
- A small urgency "!" marker appears at the checkbox top-right (high=coral, medium=amber, low=muted blue); it is hidden when unset or completed, and never blocks the checkbox click target.

## 2026-07-04 · Unified drag experience

### Improvements
- Dragging a task now moves a complete intact card that follows the pointer, replacing the old opacity-only ghost and matching TickTick's feel.
- The source slot becomes a restrained dashed placeholder that preserves layout space, instead of vanishing or only going transparent.
- Reordering inside lists, candidates, and the tree shows a clear insertion line (with a subtle pulse) so the drop target is unambiguous.
- Dropping into a Kanban column, Matrix quadrant, or tree node outlines the whole target container with a unified accent border, rather than a partial gray fill.
- Today candidates, the all-day shelf, habit child rows, and Planning's Tree / Kanban / Matrix / List views plus the timeline now share one pointer-event drag system and visual language, so behavior is consistent across surfaces.
- The Planning page has been fully migrated to the pointer-event drag system; the legacy HTML5 native drag and blue/gray custom preview are gone, and every drag overlay is a complete TaskBlock.
- Removed the legacy transparent ghost and opacity-only drag-state styling in favor of a single quartet: intact card follows pointer, placeholder slot, insertion line, and container outline.

### Fixes
- Fixed the drag preview inheriting the source's drag-state class, which made the cloned card render as a dimmed placeholder.
- Fixed the Planning page drag preview rendering as a blue-gray floating card instead of the original task block.
- Fixed per-view drag feedback styles diverging and duplicating CSS; consolidated onto shared class-driven feedback.
- Fixed page text being accidentally selected while dragging a task; text selection is now disabled during drags (inputs, textareas, and editable regions are unaffected).
- Fixed the drag source placeholder showing a purple tint; it is now a neutral gray dashed slot, staying gray in dark mode too.

## 2026-07-03 · 统一任务块与精简顶栏

### 改进
- 移除顶部沉重的当前任务栏，将正在进行的任务收敛为工作区内的紧凑状态片，不再与任务列表或时间轴争抢视觉重心。
- 统一候选任务、习惯子任务、时间轴日程块与全天日程块，全部使用共享的 TaskBlock 组件系统。
- 固定任务块解剖结构：[复选框][标题/内容][时长/元信息][操作]，同时让 candidate、scheduled、compact、habit-child 各变体分别控制密度、高度、内边距与对齐。
- 引入 Calm / Medium / Custom 三种外观模式，通过 CSS 变量与 `data-task-appearance` 控制项目强调位置、边框强度与密度。
- 优先级仅通过复选框颜色表达（低/中/高/紧急），项目色仅作底部或左侧细线注释，不主导卡片。
- 习惯分组改用 TaskGroup 容器，子任务使用 habit-child 变体，保持紧凑左对齐，不再变成 oversized 的嵌套卡片。
- 时间轴日程块使用 scheduled 变体，块高由时间轴决定，内容固定在左上角，不再继承候选任务卡片的间距。
- 候选任务、时间轴任务、习惯子项和 Planning 各视图任务统一使用项目色左侧细描边，保持同一任务块语言。
- Planning 的 Tree、Kanban、Matrix、List 任务块回到今日候选任务块的纸面视觉：干净背景、6px 圆角、项目色左侧细描边、同一套 padding、无灰底、无发光、无悬浮抬升。
- Tree 任务节点新增左侧状态框，与今日候选和 Planning 其它视图保持同一任务块解剖结构。
- Planning 页面新增左侧工具栏，筛选入口与 Tree / Kanban / Matrix / List 视图切换收纳到侧栏顶部；Tree 视图行距更紧凑，所有 Planning 视图任务块不再显示项目色左侧色条。
- 重构 Planning 工作区为结构化任务面板：左侧 44px 紧凑竖向轨道（视图切换 + 筛选），右侧为可滚动的视图容器，移除原本大留白浮动画布，任务不再悬空。
- 修复筛选系统：之前状态 / 重要度 / 紧急度筛选选项被代码过滤掉无法显示，现恢复全部筛选类型，可在面板中组合勾选。
- 新增 Linear 风格的活动筛选片栏：当前生效的筛选条件以小尺寸可移除片显示在视图上方，支持单独删除与一键清除全部。
- 拖拽体验增强：Kanban 与 Matrix 拖动时在目标列/象限内显示占位插槽与虚线高亮，拖动源以轻微淡化表示，无灰色蒙层、无发光。
- 清理已完成任务的旧版灰色蒙层与整体透明度，统一为干净的删除线 + 弱化文字 + 优先级色复选框。
- 筛选面板重构为 Linear 风格悬停级联弹出层：顶部"添加筛选"输入框，下方为双列布局——左侧类别列表（图标 / 标签 / 活动数 / 摘要 / 箭头）始终可见，鼠标悬停即展开右侧对应选项，无需点击切换；新增搜索文本、截止日期（逾期 / 本周 / 无日期）、是否已排程三类筛选。
- 视图切换器改为图标 + 短标签的紧凑竖向按钮，活动项以左侧细线标记，不再像悬挂标签。
- List 视图新增拖拽排序：行间显示插入线（带轻微脉动），拖动源淡化，松开后按新顺序写入 order 字段。
- Kanban 列头与 Matrix 象限头新增任务总数与预估总时长（仅当时长 > 0 时显示）。

### 修复
- 修复长标题挤出时长与操作按钮、复选框与下拉图标堆叠错位、习惯卡片布局不一致等问题。
- 关闭导致布局漂移的旧版任务卡覆盖样式，确保共享 TaskBlock 的网格版式在所有表面生效。
- 修复任务拖入时间轴后 scheduled 块失去绝对定位、忽略时间轴 top/height 几何而异常拉高的问题。
- 搜索入口改为 Cmd/Ctrl+K 命令面板触发，主 Chrome 不再显示显眼的搜索按钮。
- 修复今日候选任务标题纵向不居中的问题；短标题居中，多行标题作为整体居中，文字仍保持左对齐。
- 修复长任务名换行时挤出时长、操作按钮或 checkbox 的布局问题。
- 修复 Planning 侧边栏以绝对定位覆盖树状图等视图的问题，侧栏现归位到网格首列，视图区域不再被遮挡。
- 修复设置图标未贴齐顶栏右侧边缘的问题。

## 2026-07-03 · Unified task blocks and minimal header

### Improvements
- Removed the heavy top active-task bar; the running task is now shown as a compact status chip inside the workspace, no longer competing with the task list or timeline.
- Unified candidate tasks, habit child tasks, timeline scheduled blocks, and all-day blocks on the shared TaskBlock component system.
- Locked task-block anatomy to [checkbox][title/content][duration/meta][actions], while candidate, scheduled, compact, and habit-child variants now control their own density, height, padding, and alignment.
- Introduced Calm / Medium / Custom appearance modes driven by CSS variables and `data-task-appearance`, controlling accent position, border strength, and density.
- Priority is expressed only through checkbox color (low/normal/high/urgent); project color remains a thin bottom/left annotation, not a dominant card border.
- Habit groups now use the TaskGroup container, and child items use the habit-child variant, staying compact and left-aligned instead of becoming oversized nested cards.
- Timeline scheduled blocks use the scheduled variant, with height controlled by the timeline and content pinned to the top-left instead of inheriting candidate-card spacing.
- Candidate tasks, timeline tasks, habit child rows, and Planning task views now share a project-color left rule for a consistent task-block language.
- Planning Tree, Kanban, Matrix, and List task blocks now reuse the Today Candidate paper-card visual language: clean background, 6px radius, project-color left rule, matching padding, no gray fill, no glow, and no hover lift.
- Tree task nodes now include the same left status checkbox anatomy used by Today Candidate and the other Planning views.
- Planning now has a left-side tool rail that places Filter and the Tree / Kanban / Matrix / List view switcher at the top; Tree spacing is tighter, and all Planning view task blocks no longer show a project-color left strip.
- Rebuilt the Planning workspace into a structured task surface: a 44px compact vertical rail (view switcher + filter) on the left and a scrollable view container on the right, replacing the large empty floating canvas so tasks no longer drift in blank space.
- Fixed the filter system: Status / Importance / Urgency options were previously stripped out by code and never rendered; all filter types are now available and composable in the panel.
- Added a Linear-style active-filter chip bar: active filters appear as small removable chips above the views, with per-chip removal and a clear-all action.
- Drag/drop feel: Kanban and Matrix now show a placeholder slot and dashed highlight inside the target column/quadrant while dragging, with the drag source subtly dimmed; no gray film, no glow.
- Cleaned up legacy gray overlay and whole-card opacity on completed tasks, standardizing on strikethrough + muted text + priority-colored checkbox.
- Rebuilt the filter panel as a Linear-style hover cascading popover: an "Add filter" input on top, below it a two-column body — the left category list (icon / label / active count / summary / chevron) is always visible, hovering a category immediately reveals its options on the right without a click or back button. Added Search text, Due date (overdue / this week / no date), and Scheduled (scheduled / unscheduled) filter types.
- View switcher is now compact vertical buttons with icon + short label; the active view is marked by a left rule instead of a hanging tag.
- List view now supports drag-to-reorder: an insertion line (with a subtle pulse) appears between rows, the drag source dims, and the new order is written to the task's order field on drop.
- Kanban column headers and Matrix quadrant headers now show total task count and total estimated hours (only when hours > 0).

### Fixes
- Removed the remaining legacy timeline task-card, habit child mini-card, and Planning CSS-only task-card visual implementations, leaving TaskBlock variants to own candidate, Planning, scheduled, and habit-child rows.
- Moved the Execute / Planning switcher to the center of the top bar while keeping the NavoPath brand on the left and Settings on the right.
- Fixed long titles pushing duration/actions out of the row, checkbox/dropdown icon stacking, and inconsistent habit card layouts.
- Disabled legacy task-card override styles that caused layout drift, ensuring the shared TaskBlock grid anatomy applies across all surfaces.
- Fixed scheduled blocks losing absolute positioning after dragging to the timeline, which caused them to ignore timeline top/height geometry and stretch incorrectly.
- Search is now triggered through the Cmd/Ctrl+K command palette; the main chrome no longer shows a prominent search button.
- Fixed Today Candidate task title vertical alignment; short titles center normally, and wrapped multiline titles stay centered as a block while the text remains left-aligned.
- Fixed long task names pushing duration, action icons, or checkbox controls out of alignment.
- Fixed the Planning sidebar overlapping the tree and other views due to legacy absolute positioning; the sidebar now sits in the grid's first column and the view area is no longer covered.
- Fixed the settings icon not being flush with the right edge of the header.

## 2026-07-02 · Execute & Planning Redesign

### Improvements
- Header now persistently shows the active timer task with a bold outlined capsule; timer digits stay visible, and hovering reveals pause, save, discard, and focus SVG icon actions.
- Focus overlay rebuilt: Stopwatch / Pomodoro / Flowtime mode switch sits at the top, the timer is centered and oversized, and the close button moved to the top-right; the task name moved down with heavy weight, a tiny "Working" label on its left, all wrapped in a theme-colored outline with an opaque background.
- Planning filter panel switched to a Linear-style hover flyout: five chips (Project, Display, Status, Importance, Urgency) line up horizontally, each revealing a multi-select list on hover with the current selection shown on the right; the reset button sits in the filter top bar.
- Planning page shifted up, and the view-switch buttons are now vertical on the right side.
- Today candidate task cards now show status, importance, and urgency badges plus a subtask progress count; expanding reveals a color-blocked subtask list with inline toggle.
- Schedule template entry moved to the candidate panel title bar with a calendar SVG icon.
- Planning list view now displays importance, urgency, and due-date indicators.
- Habit system overhaul: habit rows restyled as compact subtask cards with smaller unified checkboxes; clicking a habit title opens the editor, and clicking the outer card opens the habit overview side panel.
- Habit editor supports title, notes, default duration, frequency rule (daily / weekly target / custom weekdays), target count, and reminder config; the overview panel shows today's completed, planned, 7/30-day completion rates, and planned minutes.
- Dragging a habit back to the candidate area unschedules it for the day, removing the timeline record while preserving completion state.

## 2026-07-02 · Execute & Planning Redesign

### Improvements
- Header now persistently shows the active timer task with a bold outlined capsule; timer digits stay visible, and hovering reveals pause, save, discard, and focus SVG icon actions.
- Focus overlay rebuilt: Stopwatch / Pomodoro / Flowtime mode switch sits at the top, the timer is centered and oversized, and the close button moved to the top-right; the task name moved down with heavy weight, a tiny "Working" label on its left, all wrapped in a theme-colored outline with an opaque background.
- Planning filter panel switched to a Linear-style hover flyout: five chips (Project, Display, Status, Importance, Urgency) line up horizontally, each revealing a multi-select list on hover with the current selection shown on the right; the reset button sits in the filter top bar.
- Planning page shifted up, and the view-switch buttons are now vertical on the right side.
- Today candidate task cards now show status, importance, and urgency badges plus a subtask progress count; expanding reveals a color-blocked subtask list with inline toggle.
- Schedule template entry moved to the candidate panel title bar with a calendar SVG icon.
- Planning list view now displays importance, urgency, and due-date indicators.
- Habit system overhaul: habit rows restyled as compact subtask cards with smaller unified checkboxes; clicking a habit title opens the editor, and clicking the outer card opens the habit overview side panel.
- Habit editor supports title, notes, default duration, frequency rule (daily / weekly target / custom weekdays), target count, and reminder config; the overview panel shows today's completed, planned, 7/30-day completion rates, and planned minutes.
- Dragging a habit back to the candidate area unschedules it for the day, removing the timeline record while preserving completion state.

## 2026-07-01 · Planning views and task timer restored

### Added
- Planning view now offers Kanban (To do / Doing / Done drag-and-drop), Eisenhower four-quadrant (important × urgent drag-and-drop), and List views, with a view switcher and filter panel (project, status, importance, urgency).
- Task-level timer: start timing from a candidate task; the header center shows the active timer task and elapsed time with pause, save, and discard controls; saving writes a time entry.
- Focus overlay: full-screen timer display with Stopwatch / Pomodoro / Flowtime mode switching for focused execution.
- Settings → Features section: toggle Kanban, Quadrant, and List views independently, and set the default focus mode plus idle threshold.

### Improved
- Planning filter bar adds a "Show completed" toggle and a "Filter" panel entry; the view switcher button group adopts the paper style.

## 2026-06-29 · Template mode and 1.2.32 release prep

### Added
- Execute template mode now supports reusable template management: create custom templates, add or remove periods, save them, and apply only the checked periods to the currently selected timeline date.

### Improved
- Built-in templates are now named Default 1 / Default 2; the Template button moved into the right-side view switcher, and the larger paper-style dialog avoids overlap with Day / 3-Day / Week / Month controls while zooming.
- Period checkboxes now render as clear empty boxes with check marks instead of solid color chips; when a daily goal is blank, the period name is used for the created time block.
- Custom templates are saved with local and cloud-synced planner data and can be deleted directly from the template dialog without affecting already-created tasks.

## 2026-06-27 · Cloud sync, AI, and responsive layout fixes

### Improved
- New users and local preview now default to light mode for the paper-like NavoPath reading experience.
- Narrow landscape windows keep Today Candidates on the left and the timeline on the right; single-view switching is reserved for portrait layouts.
- Settings cloud sync, accent color, Navo AI, and account areas now use flatter paper-style grouping with stronger dark-mode contrast.
- Account settings now show plan status in a dedicated subscription section, with Pro benefits open during the dev preview, and moves logout/about/delete actions into More.
- Account settings now split plan access into Free, Supporter, and Pro tiers and add an Afdian donation entry; the website homepage also includes a restrained donation link.
- Plugins / MCP documentation now uses a changelog-style paper page and makes clear that the current build only supports official built-in plugins shipped with the app.
- Official plugins now have Chinese names, descriptions, config labels, and enabled-state guidance; enabled tools expose Pomodoro, habit check-ins, a local weather badge, and task notes.
- AI model fallback choices now cover DeepSeek, Qwen, GLM, Kimi, MiniMax, Step, Nex, and Ling families.

### Fixed
- Fixed same-account sign-in on a fresh browser or reinstalled desktop app sometimes loading empty data; cloud profile load failures no longer silently replace the workspace with an empty profile.
- Fixed Push to cloud and Pull from cloud being skipped by pending local save queues; manual push flushes local changes first, and manual pull explicitly applies cloud data.
- Fixed Navo AI requests failing repeatedly when a model or reasoning level is incompatible, and made AI memory generation follow the current English/Chinese mode.
- Fixed the AI dialog bottom Reasoning control, project color pickers closing while selecting custom colors, Plan Suggestions covering 3-day/week dates, and collapsed/fullscreen range views not entering simplified display.
- Fixed AI requests failing when a model does not support JSON response_format by retrying without that option and keeping the stable model fallback.
- Fixed Plan Suggestions not collapsing into a compact calendar button in narrow landscape 3-day/week views.
- Removed the duplicate Cloud sync heading in Account settings and added an external-link hint to About NavoPath.
- Fixed resize previews drifting while dragging or resizing timeline blocks in 3-day/week views; short and long tasks now share hover-only resize handles, and short tasks reveal their project on hover.

---

## 2026-06-26 · Short-block resize, sync direction, and update detection

### Improvements
- Settings → Cloud sync now exposes dedicated "Push to cloud" and "Pull from cloud" direction buttons: upload this device's data alone, or overwrite this device with cloud data alone, without forcing a bidirectional merge every time — cross-device sync is now fully under your control.
- Refined task-block resize handles: the hit area is now a centered quarter of the block width so it never crowds the title, and the indicator is a thinner always-visible line that brightens on hover for less visual clutter.

### Fixes
- Fixed 15-minute and 30-minute short tasks being unable to adjust duration: short blocks can now be resized from both the top and bottom edges, with handles horizontally centered on the block, clearly visible on hover, and no longer conflicting with drag-to-move.
- Fixed the desktop app always reporting "up to date" when checking for updates; the update manifest (latest.yml) was stuck on an old version and is now regenerated correctly with each release, so new versions are detected reliably.
- Fixed duplicate background windows being created: createWindow() now reuses an existing window instead of creating a new one when called from the tray menu or app.activate events, ensuring the app only ever maintains a single visible window.

---

## 2026-06-25 · Short-block display and deletion stability

### Improved
- Settings → Plugins page rebuilt on a unified plugin registry: the Enable/Disable buttons now persist to settings and fire plugin lifecycle hooks, and Configure opens a form dialog to edit that plugin's fields (focus minutes, city, markdown toggle, etc.) with instant effect.
- The Sync button now shows a spinner during the operation and surfaces clear results: "Sync complete", "Already up to date", or a failure toast, instead of silently doing nothing.
- Added a "Launch at startup" toggle in Settings so NavoPath can open automatically when you sign in to Windows.
- Added a single-instance lock to the desktop app; launching a second copy now focuses the running window instead of opening a duplicate.
- Raised the minimum font size for 15-minute short task titles to 12px with antialiasing enabled, fixing blurry text; added a "Timeline font size" slider (85% – 130%) under Settings → Appearance so the size can be tuned for any screen.
- Redesigned the timeline quick-add popup as a single-line compact layout: removed the top time-display area, keeping only the task-name input and a confirm check button for faster entry.
- Widened the timeline left/right navigation buttons from 36px to 48px and extended the horizontal touch hit area via a pseudo-element, reducing missed taps and misfires.

### Fixed
- Fixed task blocks in "color fill" mode losing their project color when completed; the completed state now only lowers opacity while keeping the original color, and the strikethrough is layered on top so visual consistency is restored.
- Fixed signed-in users being forced into local preview mode (and unable to sign out) when the cloud profile query failed; profile failures now degrade to in-memory empty data so the signed-in session stays usable.
- Fixed the runtime fallback flag being persisted to localStorage, which permanently trapped the app in a temporary preview mode; the fallback now lasts only for the current session, the next launch retries the cloud backend, and stale persisted flags from earlier builds are cleaned up.
- Fixed deleted candidate task cards on the Execute page reappearing after deletion; all deletion paths now read from `dataRef.current` to eliminate stale-closure races.
- Fixed tasks reappearing after being deleted from the task detail drawer.
- Fixed the original task reappearing after being converted to an event.
- Fixed the app getting stuck on the loading screen when the cloud database query fails; it now automatically falls back to local preview mode so the workspace remains usable.
- Fixed the for-ever preview mode issue; runtime fallback now lasts only for the current session, so the next launch retries the cloud backend.
- Fixed 15-minute single-line task titles being clipped by resize handles and the checkbox in the timeline; the title now owns the full block height and is vertically centered without clipping.
- Fixed garbled encoding in the `package.json` description field.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-23 · More reliable desktop sign-in and sync

### Improved
- The Windows desktop app now keeps sign-in sessions in encrypted system storage, so users return directly to the workspace after closing the app or restarting the computer; signing out explicitly clears the session.
- Signed-out Windows desktop users now see a focused sign-in and registration screen instead of the marketing introduction; the website landing page remains unchanged.
- Multi-device sync now merges the latest version instead of overwriting cloud data with local data, so tasks and plans added on other devices are no longer accidentally deleted.
- Dark mode now uses a minimal neutral-gray palette inspired by Claude Code, removing blue-purple tints for higher contrast on text, cards, and settings panels.
- Accent color swatches and navigation items in Settings now use neutral backgrounds in dark mode instead of blue-purple highlights.
- The NavoPath logo in the top-left corner stays crisp in both light and dark modes, with the inverted-color filter removed.
- Setting the day start time now smoothly scrolls the timeline to that hour and shows a confirmation toast.
- The default font size is slightly larger for more comfortable reading.

### Fixed
- Fixed 3 Day, Week, and Month view switch buttons being blocked by the timeline left/right navigation hot zones.
- Fixed the desktop "Restart and install" action crashing with `quitAndInstall is not a function` after an update download, preventing the installer from launching.
- Fixed some text in dark mode remaining black and hard to read.
- Fixed 15-minute task titles being truncated in the timeline.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-24 · Timeline quick-add and short-block fixes

### Improved
- Redesigned the timeline quick-add popup as a unified card with a time label, input field, and project picker menu for a more cohesive look — no more fragmented floating layers.
- The "Day start time" setting now supports minute precision (e.g. 09:30); the timeline grid, task blocks, now-line, and drop targeting all align to the exact start.
- Overlapping tasks in the same time slot are no longer capped at 4 columns — every task gets its own column and none are hidden behind another.

### Fixed
- Fixed the quick-add panel appearing when clicking on an existing task block; it now only triggers on blank timeline slots.
- Fixed 15-minute short task blocks having clipped titles and non-functional resize handles.
- Fixed the quick-add panel staying open and persisting after saving a task; it now closes automatically while remembering the last project selected.
- Fixed timeline misalignment when rapidly clicking the add button after changing the day start time.
- Fixed deleted sub-pages on the Planning page temporarily disappearing then reappearing, preventing successful deletion.
- Fixed button and icon layout misalignment on the Planning page after adding a large number of subtasks.
- Fixed the clicked day jumping to the leftmost column in 3-day and week views after quick-add a task; the view now stays put when the target date is already visible.
- Fixed left/right date switching in the timeline not responding.
- Fixed the quick-add confirm button turning white and nearly invisible in dark mode; it is now a solid accent-colored button again.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-22 · Clearer week view and desktop icon

### Added
- The web and desktop apps now auto-sync cloud tasks, schedules, and settings every hour by default; open Settings → Account → Cloud sync to change it to every 15 minutes, every 6 hours, every 24 hours, or to disable auto-sync and rely on manual sync only.
- Settings → Account now includes a "Sync now" button that pushes local changes to the cloud and pulls the latest version on demand; the button shows "Syncing…" and is disabled while a sync is in flight.
- The last sync time is recorded and synced with the account across devices, and the Account page shows a relative timestamp ("Just now / N minutes ago / N hours ago") plus the absolute date and time.

### Improved
- The desktop icon now uses a white N face, black dimensional shadow, and transparent outer canvas so it stays clear in light and dark system surfaces.
- Collapsing Today's Candidates now consistently switches 3 Day, Week, and Month views into the compact reading mode.
- 15‑minute task blocks in the week view now show readable titles by removing the redundant check and inner padding so the title fits the narrow column.

### Fixed
- Fixed timeline fullscreen inheriting the normal workbench height and leaving a large blank area; fullscreen now fills the entire available viewport.
- View release notes now reliably opens the in-app changelog instead of depending on a temporary or untagged GitHub release URL.
- Fixed the daily timeline leaving a large blank band above 0:00 and below the all‑day bar when the day had no tasks; 0:00 now sits directly under the all‑day bar.

## 1.2.1 · 图标重绘与启动加速

### 改进
- 桌面应用图标重绘为涂鸦风格 N（白色字母 + 黑色 3D 阴影 + 透明背景），与参考图一致。
- Electron 启动速度优化：延迟加载 electron-updater、crypto 和智能备注模板，窗口创建优先级提升。

## 1.2.0 · 图标升级与安装包瘦身

### 改进
- 应用图标 N 字母改为白色填充，与深色背景和阴影形成清晰区分。
- Windows 安装包体积从 132 MB 缩小至 92 MB（-30%），app.asar 从 143 MB 降至 6.5 MB（-95%）。

### 修复
- AI 助手移除串行 Router 请求以避免 Edge Function 超时；默认改用稳定的 DeepSeek-V3.2 模型，V4 或其他模型失败时自动回退，旧 V4 设置自动迁移。

## 2026-06-21 · Continuous year calendar

### Added
- Clicking the workspace month and year now opens a continuous year calendar with direct navigation to the previous year, next year, today, or any date.
- Added latest Windows installer downloads to the website and Web workspace settings; the desktop app checks for updates every 24 hours and also supports manual download and restart-to-install.

### Improved
- The year calendar keeps Today's Candidates visible in landscape and uses a full-width month canvas while retaining the main Execute, Planning, and Add dock in portrait; the current month, selected date, today, and scheduled dates are clearly marked.
- The year calendar automatically focuses the current month, preserves the viewed month across year and orientation changes, and inherits the active page theme and interaction accent.
- The Windows desktop app now uses the same account and cloud workspace as the web app, so tasks, schedules, and settings sync when users sign in with the same account.
- The Windows desktop app now opens the `/app` workspace directly and no longer shows the marketing homepage inside the app window; the window, executable, installer, and shortcut consistently use the NavoPath name and brand icon.
- Portrait timeline tasks now require a short hold before dragging, with narrower horizontal hit areas for date arrows.
- Windows installer size is much smaller, downloads and installs faster; auto-update, PDF, DOCX, image OCR, and Supabase sync all remain available.

### Fixed
- Fixed the project list being obscured during portrait quick add, matched the task title field to dark mode, and restored an explicit close button in task and event details.

## 2026-06-20 · More reliable scheduling and connections

### Added
- The MCP settings section now shows the server endpoint, client configuration, and copyable personal access tokens directly in the app.
- Added a portrait workspace dock with mode switching, top quick add, and an expandable Navo AI prompt.

### Improved
- The marketing site now stays at the root URL, while sign-in, sign-up, email confirmation, and password recovery consistently enter the workspace at `/app`.
- Reorganized Settings into clear Page, Navo AI, MCP, and Account navigation for desktop and mobile.
- The entire right calendar panel can now drive timeline scrolling, including its heading, all-day row, and view controls.
- Multi-device sync now treats cloud data as the baseline, replays only explicitly pending local changes, and refreshes queued realtime updates after saving.
- Candidate tasks, all-day tasks, and timed blocks now share consistent drag feedback; like Trevor AI, all-day tasks can return directly to Today's Candidates with a paper preview that names the current target.
- About NavoPath now opens the changelog directly; the changelog follows the account language by default and can be switched independently in the top-right corner.
- Execute now switches between single-canvas Tasks and Schedule views on narrow screens, with touch-friendly Day and Month views.
- Planning no longer uses a temporary candidate basket; tasks and subtasks can move directly from the tree into Today's Candidates with undo support.
- Portrait layout now activates only below 900px; Navo AI opens from the top-left icon, Plan Suggestions live in the conversation panel, and the bottom dock is limited to mode switching and add.
- Portrait schedule controls now sit beside the date with one Day/Month toggle; dragging a candidate from Tasks automatically enters the timeline for placement.
- Portrait dates are now geometrically centered, with date arrows grouped before the Day/Month control; timed tasks can return to Today's Candidates from the left ruler area.
- Removed visible control borders from the portrait header and dock, shifted and enlarged the Navo icon, and gave the add button a fuller circular shape.
- The portrait Day control now opens a menu for Day, 3 Day, Week, and Month views; extra bottom scroll space keeps post-23:00 placement clear of the dock.

### Fixed
- Fixed missing MCP configuration guidance, silent token-generation failures, and the misaligned Chinese Generate button.
- Fixed unreliable dragging from the all-day row back to the timeline or Today's Candidates, and stopped the timeline from scrolling while a task is held over the all-day row; the row remains clean without gray fill or an overlapping color strip.

## 2026-06-19 · A clearer task workspace

### Added
- Added staged AI thinking feedback, capability-aware reasoning modes, and restorable task confirmation cards.
- Upgraded MCP to standard Streamable HTTP with a complete client configuration guide.

### Improved
- Reorganized Settings into Page, Navo AI, MCP, and Account sections, widened the panel, and aligned checks with task completion.
- Restored natural trackpad and momentum scrolling in the timeline and AI chat, and now show the Execute skeleton immediately at startup.
- Use charcoal text in light mode and warm ivory text with a default interaction accent in dark mode.
- Automatically convert legacy events into scheduled tasks so the workspace uses one task-based planning model.
- Added revision conflict merging, deletion records, offline retry, and real-time updates for multi-device sync.

### Fixed
- Fixed adding subtasks from task editing and made the task title field grow with multiline titles.
- Fixed AI task confirmations disappearing after restoring a conversation.

## 2026-06-18 · Workspace flow

### Added
- Added drag ordering and cross-project movement for projects, tasks, and subtasks in Planning.
- Added continuous date browsing in Month view.
- Added moving tasks from Today's Candidates back to Planning.
- Added remote HTTP MCP and personal access-token management.

### Improved
- Open Add Task by typing in the workspace.
- Follow and restart the complete onboarding workflow.
- Resolve relative AI dates using the user's local timezone.
- Prevent accidental text selection while dragging timeline tasks.

## 2026-07-01 · Planning views and task timer restored

### Added
- Planning view now offers Kanban (To do / Doing / Done drag-and-drop), Eisenhower four-quadrant (important × urgent drag-and-drop), and List views, with a view switcher and filter panel (project, status, importance, urgency).
- Task-level timer: start timing from a candidate task; the header center shows the active timer task and elapsed time with pause, save, and discard controls; saving writes a time entry.
- Focus overlay: full-screen timer display with Stopwatch / Pomodoro / Flowtime mode switching for focused execution.
- Settings → Features section: toggle Kanban, Quadrant, and List views independently, and set the default focus mode plus idle threshold.

### Improved
- Planning filter bar adds a "Show completed" toggle and a "Filter" panel entry; the view switcher button group adopts the paper style.

## 2026-06-29 · Template mode and 1.2.32 release prep

### Added
- Execute template mode now supports reusable template management: create custom templates, add or remove periods, save them, and apply only the checked periods to the currently selected timeline date.

### Improved
- Built-in templates are now named Default 1 / Default 2; the Template button moved into the right-side view switcher, and the larger paper-style dialog avoids overlap with Day / 3-Day / Week / Month controls while zooming.
- Period checkboxes now render as clear empty boxes with check marks instead of solid color chips; when a daily goal is blank, the period name is used for the created time block.
- Custom templates are saved with local and cloud-synced planner data and can be deleted directly from the template dialog without affecting already-created tasks.

## 2026-06-27 · Cloud sync, AI, and responsive layout fixes

### Improved
- New users and local preview now default to light mode for the paper-like NavoPath reading experience.
- Narrow landscape windows keep Today Candidates on the left and the timeline on the right; single-view switching is reserved for portrait layouts.
- Settings cloud sync, accent color, Navo AI, and account areas now use flatter paper-style grouping with stronger dark-mode contrast.
- Account settings now show plan status in a dedicated subscription section, with Pro benefits open during the dev preview, and moves logout/about/delete actions into More.
- Account settings now split plan access into Free, Supporter, and Pro tiers and add an Afdian donation entry; the website homepage also includes a restrained donation link.
- Plugins / MCP documentation now uses a changelog-style paper page and makes clear that the current build only supports official built-in plugins shipped with the app.
- Official plugins now have Chinese names, descriptions, config labels, and enabled-state guidance; enabled tools expose Pomodoro, habit check-ins, a local weather badge, and task notes.
- AI model fallback choices now cover DeepSeek, Qwen, GLM, Kimi, MiniMax, Step, Nex, and Ling families.

### Fixed
- Fixed same-account sign-in on a fresh browser or reinstalled desktop app sometimes loading empty data; cloud profile load failures no longer silently replace the workspace with an empty profile.
- Fixed Push to cloud and Pull from cloud being skipped by pending local save queues; manual push flushes local changes first, and manual pull explicitly applies cloud data.
- Fixed Navo AI requests failing repeatedly when a model or reasoning level is incompatible, and made AI memory generation follow the current English/Chinese mode.
- Fixed the AI dialog bottom Reasoning control, project color pickers closing while selecting custom colors, Plan Suggestions covering 3-day/week dates, and collapsed/fullscreen range views not entering simplified display.
- Fixed AI requests failing when a model does not support JSON response_format by retrying without that option and keeping the stable model fallback.
- Fixed Plan Suggestions not collapsing into a compact calendar button in narrow landscape 3-day/week views.
- Removed the duplicate Cloud sync heading in Account settings and added an external-link hint to About NavoPath.
- Fixed resize previews drifting while dragging or resizing timeline blocks in 3-day/week views; short and long tasks now share hover-only resize handles, and short tasks reveal their project on hover.

---

## 2026-06-26 · Short-block resize, sync direction, and update detection

### Improvements
- Settings → Cloud sync now exposes dedicated "Push to cloud" and "Pull from cloud" direction buttons: upload this device's data alone, or overwrite this device with cloud data alone, without forcing a bidirectional merge every time — cross-device sync is now fully under your control.
- Refined task-block resize handles: the hit area is now a centered quarter of the block width so it never crowds the title, and the indicator is a thinner always-visible line that brightens on hover for less visual clutter.

### Fixes
- Fixed 15-minute and 30-minute short tasks being unable to adjust duration: short blocks can now be resized from both the top and bottom edges, with handles horizontally centered on the block, clearly visible on hover, and no longer conflicting with drag-to-move.
- Fixed the desktop app always reporting "up to date" when checking for updates; the update manifest (latest.yml) was stuck on an old version and is now regenerated correctly with each release, so new versions are detected reliably.
- Fixed duplicate background windows being created: createWindow() now reuses an existing window instead of creating a new one when called from the tray menu or app.activate events, ensuring the app only ever maintains a single visible window.

---

## 2026-06-25 · Short-block display and deletion stability

### Improved
- Settings → Plugins page rebuilt on a unified plugin registry: the Enable/Disable buttons now persist to settings and fire plugin lifecycle hooks, and Configure opens a form dialog to edit that plugin's fields (focus minutes, city, markdown toggle, etc.) with instant effect.
- The Sync button now shows a spinner during the operation and surfaces clear results: "Sync complete", "Already up to date", or a failure toast, instead of silently doing nothing.
- Added a "Launch at startup" toggle in Settings so NavoPath can open automatically when you sign in to Windows.
- Added a single-instance lock to the desktop app; launching a second copy now focuses the running window instead of opening a duplicate.
- Raised the minimum font size for 15-minute short task titles to 12px with antialiasing enabled, fixing blurry text; added a "Timeline font size" slider (85% – 130%) under Settings → Appearance so the size can be tuned for any screen.
- Redesigned the timeline quick-add popup as a single-line compact layout: removed the top time-display area, keeping only the task-name input and a confirm check button for faster entry.
- Widened the timeline left/right navigation buttons from 36px to 48px and extended the horizontal touch hit area via a pseudo-element, reducing missed taps and misfires.

### Fixed
- Fixed task blocks in "color fill" mode losing their project color when completed; the completed state now only lowers opacity while keeping the original color, and the strikethrough is layered on top so visual consistency is restored.
- Fixed signed-in users being forced into local preview mode (and unable to sign out) when the cloud profile query failed; profile failures now degrade to in-memory empty data so the signed-in session stays usable.
- Fixed the runtime fallback flag being persisted to localStorage, which permanently trapped the app in a temporary preview mode; the fallback now lasts only for the current session, the next launch retries the cloud backend, and stale persisted flags from earlier builds are cleaned up.
- Fixed deleted candidate task cards on the Execute page reappearing after deletion; all deletion paths now read from `dataRef.current` to eliminate stale-closure races.
- Fixed tasks reappearing after being deleted from the task detail drawer.
- Fixed the original task reappearing after being converted to an event.
- Fixed the app getting stuck on the loading screen when the cloud database query fails; it now automatically falls back to local preview mode so the workspace remains usable.
- Fixed the for-ever preview mode issue; runtime fallback now lasts only for the current session, so the next launch retries the cloud backend.
- Fixed 15-minute single-line task titles being clipped by resize handles and the checkbox in the timeline; the title now owns the full block height and is vertically centered without clipping.
- Fixed garbled encoding in the `package.json` description field.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-23 · More reliable desktop sign-in and sync

### Improved
- The Windows desktop app now keeps sign-in sessions in encrypted system storage, so users return directly to the workspace after closing the app or restarting the computer; signing out explicitly clears the session.
- Signed-out Windows desktop users now see a focused sign-in and registration screen instead of the marketing introduction; the website landing page remains unchanged.
- Multi-device sync now merges the latest version instead of overwriting cloud data with local data, so tasks and plans added on other devices are no longer accidentally deleted.
- Dark mode now uses a minimal neutral-gray palette inspired by Claude Code, removing blue-purple tints for higher contrast on text, cards, and settings panels.
- Accent color swatches and navigation items in Settings now use neutral backgrounds in dark mode instead of blue-purple highlights.
- The NavoPath logo in the top-left corner stays crisp in both light and dark modes, with the inverted-color filter removed.
- Setting the day start time now smoothly scrolls the timeline to that hour and shows a confirmation toast.
- The default font size is slightly larger for more comfortable reading.

### Fixed
- Fixed 3 Day, Week, and Month view switch buttons being blocked by the timeline left/right navigation hot zones.
- Fixed the desktop "Restart and install" action crashing with `quitAndInstall is not a function` after an update download, preventing the installer from launching.
- Fixed some text in dark mode remaining black and hard to read.
- Fixed 15-minute task titles being truncated in the timeline.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-24 · Timeline quick-add and short-block fixes

### Improved
- Redesigned the timeline quick-add popup as a unified card with a time label, input field, and project picker menu for a more cohesive look — no more fragmented floating layers.
- The "Day start time" setting now supports minute precision (e.g. 09:30); the timeline grid, task blocks, now-line, and drop targeting all align to the exact start.
- Overlapping tasks in the same time slot are no longer capped at 4 columns — every task gets its own column and none are hidden behind another.

### Fixed
- Fixed the quick-add panel appearing when clicking on an existing task block; it now only triggers on blank timeline slots.
- Fixed 15-minute short task blocks having clipped titles and non-functional resize handles.
- Fixed the quick-add panel staying open and persisting after saving a task; it now closes automatically while remembering the last project selected.
- Fixed timeline misalignment when rapidly clicking the add button after changing the day start time.
- Fixed deleted sub-pages on the Planning page temporarily disappearing then reappearing, preventing successful deletion.
- Fixed button and icon layout misalignment on the Planning page after adding a large number of subtasks.
- Fixed the clicked day jumping to the leftmost column in 3-day and week views after quick-add a task; the view now stays put when the target date is already visible.
- Fixed left/right date switching in the timeline not responding.
- Fixed the quick-add confirm button turning white and nearly invisible in dark mode; it is now a solid accent-colored button again.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-22 · Clearer week view and desktop icon

### Added
- The web and desktop apps now auto-sync cloud tasks, schedules, and settings every hour by default; open Settings → Account → Cloud sync to change it to every 15 minutes, every 6 hours, every 24 hours, or to disable auto-sync and rely on manual sync only.
- Settings → Account now includes a "Sync now" button that pushes local changes to the cloud and pulls the latest version on demand; the button shows "Syncing…" and is disabled while a sync is in flight.
- The last sync time is recorded and synced with the account across devices, and the Account page shows a relative timestamp ("Just now / N minutes ago / N hours ago") plus the absolute date and time.

### Improved
- The desktop icon now uses a white N face, black dimensional shadow, and transparent outer canvas so it stays clear in light and dark system surfaces.
- Collapsing Today's Candidates now consistently switches 3 Day, Week, and Month views into the compact reading mode.
- 15‑minute task blocks in the week view now show readable titles by removing the redundant check and inner padding so the title fits the narrow column.

### Fixed
- Fixed timeline fullscreen inheriting the normal workbench height and leaving a large blank area; fullscreen now fills the entire available viewport.
- View release notes now reliably opens the in-app changelog instead of depending on a temporary or untagged GitHub release URL.
- Fixed the daily timeline leaving a large blank band above 0:00 and below the all‑day bar when the day had no tasks; 0:00 now sits directly under the all‑day bar.

## 2026-06-21 · Continuous year calendar

### Added
- Clicking the workspace month and year now opens a continuous year calendar with direct navigation to the previous year, next year, today, or any date.
- Added latest Windows installer downloads to the website and Web workspace settings; the desktop app checks for updates every 24 hours and also supports manual download and restart-to-install.

### Improved
- The year calendar keeps Today's Candidates visible in landscape and uses a full-width month canvas while retaining the main Execute, Planning, and Add dock in portrait; the current month, selected date, today, and scheduled dates are clearly marked.
- The year calendar automatically focuses the current month, preserves the viewed month across year and orientation changes, and inherits the active page theme and interaction accent.
- The Windows desktop app now uses the same account and cloud workspace as the web app, so tasks, schedules, and settings sync when users sign in with the same account.
- The Windows desktop app now opens the `/app` workspace directly and no longer shows the marketing homepage inside the app window; the window, executable, installer, and shortcut consistently use the NavoPath name and brand icon.
- Portrait timeline tasks now require a short hold before dragging, with narrower horizontal hit areas for date arrows.
- Windows installer size is much smaller, downloads and installs faster; auto-update, PDF, DOCX, image OCR, and Supabase sync all remain available.

### Fixed
- Fixed the project list being obscured during portrait quick add, matched the task title field to dark mode, and restored an explicit close button in task and event details.

## 2026-06-20 · More reliable scheduling and connections

### Added
- The MCP settings section now shows the server endpoint, client configuration, and copyable personal access tokens directly in the app.
- Added a portrait workspace dock with mode switching, top quick add, and an expandable Navo AI prompt.

### Improved
- The marketing site now stays at the root URL, while sign-in, sign-up, email confirmation, and password recovery consistently enter the workspace at `/app`.
- Reorganized Settings into clear Page, Navo AI, MCP, and Account navigation for desktop and mobile.
- The entire right calendar panel can now drive timeline scrolling, including its heading, all-day row, and view controls.
- Multi-device sync now treats cloud data as the baseline, replays only explicitly pending local changes, and refreshes queued realtime updates after saving.
- Candidate tasks, all-day tasks, and timed blocks now share consistent drag feedback; like Trevor AI, all-day tasks can return directly to Today's Candidates with a paper preview that names the current target.
- About NavoPath now opens the changelog directly; the changelog follows the account language by default and can be switched independently in the top-right corner.
- Execute now switches between single-canvas Tasks and Schedule views on narrow screens, with touch-friendly Day and Month views.
- Planning no longer uses a temporary candidate basket; tasks and subtasks can move directly from the tree into Today's Candidates with undo support.
- Portrait layout now activates only below 900px; Navo AI opens from the top-left icon, Plan Suggestions live in the conversation panel, and the bottom dock is limited to mode switching and add.
- Portrait schedule controls now sit beside the date with one Day/Month toggle; dragging a candidate from Tasks automatically enters the timeline for placement.
- Portrait dates are now geometrically centered, with date arrows grouped before the Day/Month control; timed tasks can return to Today's Candidates from the left ruler area.
- Removed visible control borders from the portrait header and dock, shifted and enlarged the Navo icon, and gave the add button a fuller circular shape.
- The portrait Day control now opens a menu for Day, 3 Day, Week, and Month views; extra bottom scroll space keeps post-23:00 placement clear of the dock.

### Fixed
- Fixed missing MCP configuration guidance, silent token-generation failures, and the misaligned Chinese Generate button.
- Fixed unreliable dragging from the all-day row back to the timeline or Today's Candidates, and stopped the timeline from scrolling while a task is held over the all-day row; the row remains clean without gray fill or an overlapping color strip.

## 2026-06-19 · A clearer task workspace

### Added
- Added staged AI thinking feedback, capability-aware reasoning modes, and restorable task confirmation cards.
- Upgraded MCP to standard Streamable HTTP with a complete client configuration guide.

### Improved
- Reorganized Settings into Page, Navo AI, MCP, and Account sections, widened the panel, and aligned checks with task completion.
- Restored natural trackpad and momentum scrolling in the timeline and AI chat, and now show the Execute skeleton immediately at startup.
- Use charcoal text in light mode and warm ivory text with a default interaction accent in dark mode.
- Automatically convert legacy events into scheduled tasks so the workspace uses one task-based planning model.
- Added revision conflict merging, deletion records, offline retry, and real-time updates for multi-device sync.

### Fixed
- Fixed adding subtasks from task editing and made the task title field grow with multiline titles.
- Fixed AI task confirmations disappearing after restoring a conversation.

## 2026-06-18 · Workspace flow

### Added
- Added drag ordering and cross-project movement for projects, tasks, and subtasks in Planning.
- Added continuous date browsing in Month view.
- Added moving tasks from Today's Candidates back to Planning.
- Added remote HTTP MCP and personal access-token management.

### Improved
- Open Add Task by typing in the workspace.
- Follow and restart the complete onboarding workflow.
- Resolve relative AI dates using the user's local timezone.
- Prevent accidental text selection while dragging timeline tasks.

