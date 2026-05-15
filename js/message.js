/* z-index:
    0  - main middle;
    5  - main top;
    9  - main bottom;
    10 - show gameboard/keyboard;
    20 - view number;
    21 - view number middle;
    25 - view number top;
    29 - view number bottom;
    30 - statistics middle;
    35 - statistics top;
    39 - statistics bottom;
    50 - stats distance detail
    60 - play scope
    70 - file;
    71 - file main;
    75 - file top;
    79 - file bottom;
    90 - import;
    91 - games config;
    93 - bets manage;
    95 - tools;
*/



function OnPageInit()
{
    g_waves.Init();

    PageInit_Data(true);

    Show_Keyboard(true);
    Show_3C3R();
    Show_Queue();
    Show_Columns();
    Show_FinishedLong();
    Show_RefreshColumnsButtons();
    Show_StatsGroupsCount();
    Show_RefreshStatsGroupButtons();
    Show_RefreshSysButtons();
    Show_RefreshStatsFrequencyDetailButtons();

    Show_RefreshStatsSumButtons();
    Show_SumLists();
    Show_StatsGames(-1, true); // 打法（主页）

    Init_Theme();
    Show_RefreshTheme();

    if (g_nDebug == 1)
        ChangeTheme("debug");

    SwitchStatsColRow(-1);
    SwitchStatsRounds(-1);
    SwitchStatsOther(-1);
}


function OnSwitchInput(nIdx)
{
    var divK = document.getElementById("divKeyboard");
    var divB = document.getElementById("divGameBoard");

    if (nIdx == 0)
    {
        divK.style.display = "none";
        divB.style.display = "";
        g_status.KeyboardID = "B";
    }
    else
    {
        divB.style.display = "none";
        divK.style.display = "";
        g_status.KeyboardID = "K";
    }

    WriteData(DATA_KEYBOARDID, g_status.KeyboardID);
}

function OnSysExpand()
{
    g_status.QueueExpand++;
    g_status.QueueExpand = g_status.QueueExpand % 2;

    Show_Queue();
    Show_RefreshSysButtons();
}


function OnShowKeyboardClick()
{
    if (g_nShowInputStatus == 1)
    {
        Show_Keyboard(false);
    }
    else
    {
        Show_Keyboard(true);
    }

}

function OnHideKeyboard()
{
    Show_Keyboard(false);
}

function OnShowKeyboard()
{
    Show_Keyboard(true);
}

function OnEscape()
{
    g_status.Escape++;
    g_status.Escape = g_status.Escape % 2;

    ChangeTheme((g_status.Escape == 0) ? ((g_status.ThemeID == 0) ? "normal" : "color") : "grey");
}

function OnSeperate3C3RClick()
{
    g_status.Seperate3C3R = SwitchTrueFalse(g_status.Seperate3C3R);
    WriteData(DATA_SEPERATE3C3R, g_status.Seperate3C3R);

    Show_3C3R();
}

function DoAddNum(num)
{
    Calc_AddNum(num);
    Calc_Sum();
    Show_AddNum();
    SaveNumbers();
}

function OnAddNum(num)
{
    var nLen = g_anDelNum.length;
    if(nLen > 0)
        g_anDelNum.splice(0, nLen);

    DoAddNum(num);
}

function OnStatsSumListClick(nID)
{
    var C_EXPAND_HEIGHT = 144;
    var C_COLLAPSE_HEIGHT = 48;

    var nHeight = C_EXPAND_HEIGHT;

    for (var n = 0; n < g_status.anStatsSumExpand.length; ++n)
    {
        if (n == nID)
        {
            if (g_status.anStatsSumExpand[n] == 0)
                g_status.anStatsSumExpand[n] = 1;
            else
                g_status.anStatsSumExpand[n] = 0;
        }
        else
        {
            g_status.anStatsSumExpand[n] = 0;
        }

        if (g_status.anStatsSumExpand[n] == 1)
            nHeight = C_EXPAND_HEIGHT + ((n == 3) ? 2 * (C_COLLAPSE_HEIGHT - 2) : 0);
        else
            nHeight = C_COLLAPSE_HEIGHT;

        var div = document.getElementById("divStatsSumListItem" + n.toString());
        div.style.height = nHeight;
    }
}

function OnImport()
{
    var txt = document.getElementById("txtClipboard");
    var strNum = txt.value;

    ResetDataFromNumString(strNum, "import", AfterImportData);
}

function OnDelNum()
{
    if (g_queue.nIDX < 0)
        return;

    var num = g_queue.anNum[g_queue.nIDX];
    g_anDelNum.push(num);

    if (g_queue.nIDX == 0)
    {
        PageInit_Data(false);
        Show_AddNum();

        return;
    }

    var anNum = [];

    for(var n = 0; n < g_queue.nIDX; ++ n)
        anNum[n] = g_queue.anNum[n];

    ResetData(anNum, false);
    SaveNumbers();
}

function OnForward()
{
    if(g_anDelNum.length <= 0)
        return;

    DoAddNum(g_anDelNum.pop());
}

// ----------------------------------------------

function Show_RefreshColumnsButtons()
{
    g_bttnColumns.Show("divColumnsBttns");
}

function OnBttnColumnsClick(nIdx)
{
    g_bttnColumns.OnClick(nIdx);
    Show_Columns();
}

// ----------------------------------------------

function Show_RefreshStatsGroupButtons()
{
    g_bttnStatsGroups.Show("divStatsGroupsBttns");
}

function OnBttnStatsGroupsClick(nIdx)
{
    g_bttnStatsGroups.OnClick(nIdx);
    Show_StatsGroupsCount();
}

// ----------------------------------------------

function Show_RefreshStatsSumButtons()
{
    g_bttnStatsSum.Show("divStatsSumBttns");
}

function OnBttnStatsSumClick(nIdx)
{
    g_bttnStatsSum.OnClick(nIdx);
    Show_SumLists();
}


// ----------------------------------------------


function Show_RefreshStatsButtons()
{
    g_bttnStats.Show("divStatsBttns");
}

function OnBttnStatsClick(nIdx)
{
    g_bttnStats.OnClick(nIdx);
    if (!IsDirectStatsTabIdx(nIdx))
    {
        g_status.IndirectStatsIdx = nIdx;
        WriteIntData(DATA_INDIRECTSTATSIDX, nIdx);
    }
    SwitchStats();
}


// ----------------------------------------------


function Show_RefreshStatsColRowButtons()
{
    g_bttnStatsColRow.Show("divStatsColRowBttns");
}

function OnBttnStatsColRowClick(nIdx)
{
    g_bttnStatsColRow.OnClick(nIdx);
    SwitchStatsColRow(nIdx);
}


// ----------------------------------------------


function Show_RefreshStatsOtherButtons()
{
    g_bttnStatsOther.Show("divStatsOtherBttns");
}

function OnBttnStatsOtherClick(nIdx)
{
    g_bttnStatsOther.OnClick(nIdx);
    SwitchStatsOther(nIdx);
}


// ----------------------------------------------

function Show_RefreshStatsScopeButtons()
{
    g_bttnStatsScope.Show("divStatsScopeBttns");
}

function OnBttnStatsScopeClick(nIdx)
{
    g_bttnStatsScope.OnClick(nIdx);
    g_waves.ResetScope(g_bttnStatsScope.Value());

    Show_StatsGames(-1, false); // 打法（非主页）
    Show_StatsGames(-1, true);  // 打法（主页）

    g_waves.CalcCRC();
    Show_StatsColRowChart();    // 行组 - 统计图
    Show_StatsColRowSum();      // 行组 - 统计数据

    Show_StatsCRDCompare(-1);   // 细化 - 各行各组比较
    Show_StatsNumbers(-1);      // 其它 - 号码
    Show_StatsLongs();          // 其它 - 追打
    Show_StatsRounds();         // 其它 - 轮次 - 轮次统计数据
    Show_StatsRoundBet();       // 其它 - 轮次 - 轮次参考数据
}

// ----------------------------------------------


function Show_RefreshStatsFrequencyScopeButtons()
{
    g_bttnStatsFrequencyScope.Show("divStatsFrequencyScopeBttns");
}

function OnBttnStatsFrequencyScopeClick(nIdx)
{
    g_bttnStatsFrequencyScope.OnClick(nIdx);
    Show_StatsFrequencies();       // 频率 - 多行组单区域
    Show_StatsFrequenciesDetail(); // 频率 - 单行组多区域
}

// ----------------------------------------------

function Show_RefreshStatsLongsBetButtons()
{
    g_bttnStatsLongsBet.Show("divStatsLongsBetBttns");
}

function OnBttnStatsLongsBetClick(nIdx)
{
    g_bttnStatsLongsBet.OnClick(nIdx);
    Show_StatsLongs(); // 其它 - 追打
}

// ----------------------------------------------

function Show_RefreshStatsLongsButtons()
{
    g_bttnStatsLongs.Show("divStatsLongsBttns");
}

function OnBttnStatsLongsClick(nIdx)
{
    g_bttnStatsLongs.OnClick(nIdx);
    Show_StatsLongs(); // 其它 - 追打
}

// ----------------------------------------------

function Show_RefreshStatsFrequencyDetailButtons()
{
    g_bttnStatsFrequencyDetail.Show("divStatsFrequencyDetailBttns");
}

function OnBttnStatsFrequencyDetailClick(nIdx)
{
    g_bttnStatsFrequencyDetail.OnClick(nIdx);

    if(g_bttnStatsFrequencyDetail.Value() != g_waves.nFrequnceyCR)
    {
        g_waves.nFrequnceyCR = g_bttnStatsFrequencyDetail.Value();
        Show_StatsFrequenciesDetail();
    }
}

// ----------------------------------------------

function Show_RefreshViewNumButtons()
{
    g_bttnViewNum.Show("divViewNumBttns");
}

function OnBttnViewNumClick(nIdx)
{
    g_bttnViewNum.OnClick(nIdx);
    Show_ViewNum();
}


// ----------------------------------------------

function SwithStatsCRDWindow()
{
    var div0 = document.getElementById("divStatsCRDCompare");
    var div1 = document.getElementById("divStatsCRDDetail");

    var bDiv0 = (g_bttnStatsCRDOpt.Value() == 0);
    div0.style.display = bDiv0 ? "" : "none";
    div1.style.display = bDiv0 ? "none" : "";
}

function Show_RefreshStatsCRDOptButtons()
{
    g_bttnStatsCRDOpt.Show("divStatsCRDOptBttns");
    SwithStatsCRDWindow();
}

function OnBttnStatsCRDOptClick(nIdx)
{
    g_bttnStatsCRDOpt.OnClick(nIdx);
    SwithStatsCRDWindow();
}


// ----------------------------------------------

function Show_RefreshStatsCRDRoundStartButtons()
{
    g_bttnStatsCRDRoundStart.Show("divStatsCRDRoundStartBttns");
}

function OnBttnStatsCRDRoundStartClick(nIdx)
{
    g_bttnStatsCRDRoundStart.OnClick(nIdx);
    Show_StatsCRDCompare(-1);
}


// ----------------------------------------------

function Show_RefreshStatsCRDRoundBetButtons()
{
    g_bttnStatsCRDRoundBet.Show("divStatsCRDRoundBetBttns");
}

function OnBttnStatsCRDRoundBetClick(nIdx)
{
    g_bttnStatsCRDRoundBet.OnClick(nIdx);
    Show_StatsCRDCompare(-1);
}


function OnStatsCRDCompareClick(nSortCol)
{
    Show_StatsCRDCompare(nSortCol);
}

// ----------------------------------------------

function OnStatsRoundsClick(nIdx)
{
    SwitchStatsRounds(nIdx);
}


// ----------------------------------------------------------------------------

function SwitchWindows(astrDiv, nIdx, KEY_DATA)
{
    var nIdxSwitch = nIdx;

    if (nIdxSwitch < 0)
        nIdxSwitch = ReadIntData(KEY_DATA, 0);

    if (nIdxSwitch >= astrDiv.length)
        nIdxSwitch = astrDiv.length - 1;

    for (var n = 0; n < astrDiv.length; ++n)
    {
        var strDisplay = "";
        if (n != nIdxSwitch)
            strDisplay = "none";

        var div = document.getElementById(astrDiv[n]);
        div.style.display = strDisplay;
    }

    WriteIntData(KEY_DATA, nIdxSwitch);
}

function SwitchStatsColRow(nIdx)
{
    ShowStatsScopeBttns(IDX_TAB_COLROW, nIdx);

    var astrDiv = ["divStatsColRowDetail", "divStatsColRowChart", "divStatsColRowSum"];
    SwitchWindows(astrDiv, nIdx, DATA_STATSCOLROWIDX);

    Show_StatsColRowDetail();    // 行组 - 明细

    g_waves.CalcCRC();
    Show_StatsColRowChart();     // 行组 - 统计图
    Show_StatsColRowSum();       // 行组 - 统计数据
}

function SwitchStatsRounds(nIdx)
{
    var astrDiv = ["divStatsRoundBet", "divStatsRoundSum"];
    SwitchWindows(astrDiv, nIdx, DATA_STATSROUNDSIDX);
}

function SwitchStatsOther(nIdx)
{
    var astrDiv = ["divStatsOtherLongs", "divStatsOtherNumbers", "divStatsOtherRounds"];
    SwitchWindows(astrDiv, nIdx, DATA_STATSOTHERIDX);
}

function SwitchStats()
{
    var nIdx = g_bttnStats.Value();

    for (var n = 0; n < g_astrStatsDiv.length; ++n)
    {
        var strDisplay = "";
        if (n != g_bttnStats.nSelIdx)
            strDisplay = "none";

        var div = document.getElementById("divStats" + g_astrStatsDiv[n]);
        div.style.display = strDisplay;
    }

    ShowStatsScopeBttns(nIdx, g_bttnStatsColRow.Value());

    var td = document.getElementById("tdStatsTitle");
    td.innerHTML = g_astrStatsTitle[nIdx];
}

function OnStatsNumClick(nCol)
{
    Show_StatsNumbers(nCol); // 其它 - 号码
}

function OnStatsGamesClick(nCol)
{
    Show_StatsGames(nCol, true); // 打法（非主页）
    Show_StatsGames(-1, false); // 打法（主页）
}

// 暂时取消这个功能：
function OnShowHideMoreButtons()
{
    var tr1 = document.getElementById("trBttnMore");
    var tr2 = document.getElementById("trBttnEmpty");

    var strDisplay = "";
    if (tr1.style.display == "")
        strDisplay = "none";

    tr1.style.display = strDisplay;
    tr2.style.display = strDisplay;
}

// 打开统计页面：
function OpenStatistics(strID)
{
    if (g_queue.nIDX < 0)
        return;

    if (((strID == "f") || (strID == "d") || (strID == "l")) && (g_queue.nIDX < 1))
        return;

    // 这个放在最前面是因为只有这样 Show_StatsColRowSum()中的ShowStatsCREGrids() 才有效
    SwitchWindow("divMain", "divStats");

    ShowStatitics();

    if (strID == "g") // games
    {
        g_bttnStats.nSelIdx = IDX_TAB_GAMES;
    }
    else if (strID == "cr") // colrow
    {
        g_bttnStats.nSelIdx = IDX_TAB_COLROW;
    }
    else if (strID == "d") // distances
    {
        g_bttnStats.nSelIdx = IDX_TAB_DISTANCES;
    }
    else if (strID == "f") // frequencies
    {
        g_bttnStats.nSelIdx = IDX_TAB_FREQUENCIES;
    }
    else if (strID == "crd") // colrowdig
    {
        g_bttnStats.nSelIdx = IDX_TAB_COLROWDIG;
    }
    else if (strID == "s") // stats
    {
        g_bttnStats.nSelIdx = g_status.IndirectStatsIdx;
    }

    Show_RefreshStatsScopeButtons();
    Show_RefreshStatsFrequencyScopeButtons();
    Show_RefreshStatsColRowButtons();
    Show_RefreshStatsLongsButtons();
    Show_RefreshStatsLongsBetButtons();
    Show_RefreshStatsOtherButtons();
    Show_RefreshStatsButtons();
    Show_RefreshStatsCRDOptButtons();
    Show_RefreshStatsCRDRoundStartButtons();
    Show_RefreshStatsCRDRoundBetButtons();

    SwitchStats();
}

function OnMainSwitchStats(bShowGames)
{
    var strDisplay1 = "";
    var strDisplay2 = "";

    if (bShowGames)
        strDisplay2 = "none";
    else
        strDisplay1 = "none";

    var div1 = document.getElementById("divMainStatsGames");
    var div2 = document.getElementById("divMainStatsSum");

    div1.style.display = strDisplay1;
    div2.style.display = strDisplay2;
}


function OnSwitchStatsFrequenciesDrawDetail(nIdx)
{
    if (nIdx == 1)
    {
        var div = document.getElementById("divStatsFrequenciesDraw");
        var nDivW = div.offsetWidth;
        var nDivH = div.offsetHeight;

        var mouseX = event.clientX;
        var mouseY = event.clientY;

        var fPos = 0;
        if (nDivH != 0)
            fPos = mouseY * 1.0 / nDivH;

        var nCR = Math.floor((fPos - 110.0 / nDivH) * 10);

        if ((nCR < 0) || (nCR > 7) || ((nCR == 3) || (nCR == 7)))
            return;

        g_waves.nFrequnceyCR = nCR;

        g_bttnStatsFrequencyDetail.OnClick((nCR < 4)? nCR : (nCR - 1));
        /*
        var divT = document.getElementById("divStatsFrequenciesDetailTitle");
        divT.innerHTML = "各区间频率图 - " + GetColRowLongSpec(nCR);
        */

        Show_StatsFrequenciesDetail();
    }
    else
    {
        g_waves.nFrequnceyCR = -1;

        Show_StatsFrequencies();
    }

    var div1 = document.getElementById("divStatsFrequencyScopeBttns");
    div1.style.display = (nIdx == 0) ? "" : "none";

    var astrID = ["divStatsFrequenciesDetail", "divStatsFrequenciesDraw"];
    for (var n = 0; n < 2; ++n)
    {
        var div = document.getElementById(astrID[n]);
        div.style.display = ((nIdx == n) ? "none" : "");
    }
}


function OnConfigCancel()
{
    var div = document.getElementById("divConfig");
    div.style.display = "none";
}

function OnConfigOK()
{
    var selBets = $('#dgGameBets').datagrid('getChecked');
    if (selBets.length <= 0)
    {
        jAlert("至少要选择一个打法！", "打法配置");
        return;
    }

    var selRnds = $('#dgGameRnds').datagrid('getChecked');
    if (selRnds.length <= 0)
    {
        jAlert("至少要选择一个轮次！", "打法配置");
        return;
    }

    var selACRs = $('#dgARCOption').datagrid('getChecked');
    if (selACRs.length <= 0)
    {
        jAlert("至少要选择一个行组选项！", "打法配置");
        return;
    }

    g_gamebets.betsels.rows.splice(0, g_gamebets.betsels.rows.length);
    g_gamebets.betsels.total = selBets.length;
    for (var n = 0; n < selBets.length; ++n)
        g_gamebets.betsels.rows[n] = new CArrayValue(selBets[n].v);
    g_gamebets.SaveBetSels();

    g_gamebets.rndsels.rows.splice(0, g_gamebets.rndsels.rows.length);
    g_gamebets.rndsels.total = selRnds.length;
    for (var n = 0; n < selRnds.length; ++n)
        g_gamebets.rndsels.rows[n] = new CValue(selRnds[n].v);
    g_gamebets.SaveRndSels();
    
    g_gamebets.ACRsels.rows.splice(0, g_gamebets.ACRsels.rows.length);
    g_gamebets.ACRsels.total = selRnds.length;
    for (var n = 0; n < selACRs.length; ++n)
        g_gamebets.ACRsels.rows[n] = new CValue(selACRs[n].v);
    g_gamebets.SaveACRSels();

    Show_StatsGames(-1, false); // 打法（非主页）
    Show_StatsGames(-1, true); // 打法（主页）

    var div = document.getElementById("divConfig");
    div.style.display = "none";
}


function UpdateDataGridBetsRowColor(strDataGrid, index, row)
{
    var strStyle = "";

    if (g_gamebets.IsDefaultBet(row.v))
    {
        var rows = $('#' + strDataGrid).datagrid('getSelections');
        var bSelected = false;
        for (var n = 0; n < rows.length; ++n)
        {
            if ($('#' + strDataGrid).datagrid('getRowIndex', rows[n]) == index)
            {
                bSelected = true;
                break;
            }
        }
        var strColor = "";
        if (bSelected)
            strColor = "#e5dfcf";
        else
            strColor = "#f3f3f3";

        strStyle = "background-color:" + strColor + ";";
    }

    return strStyle;
}


function OnConfigManage()
{
    $(function ()
    {
        $('#dgBetsManage').datagrid({
            data: g_gamebets.bets,
            singleSelect: false,
            showHeader: false,
            rowStyler: function (index, row)
            {
                return UpdateDataGridBetsRowColor('dgBetsManage', index, row);
            },
            onClickRow: function (nIdxRow)
            {
                UpdateConfigManageButtonStatus();
            },
            onSelect: function (index, row)
            {
                $('#dgBetsManage').datagrid('refreshRow', index);
            },
            onUnselect: function (index, row)
            {
                $('#dgBetsManage').datagrid('refreshRow', index);
            },
        });
    });

    UpdateConfigManageButtonStatus();

    var div = document.getElementById("divBetsManage");
    div.style.display = "";
}


function OnBetsManageAdd()
{
    $.messager.defaults = { ok: "确定", cancel: "取消", width: 700, top: 300 };
    $.messager.prompt('添加打法', '请输入新打法：', function (strBet)
    {
        var rb = true;
        
        if (strBet != null)
        {
            var strTxt = strBet.replace(/[ ]/g, ",");
            strTxt = strTxt.replace(/[，]/g, ",");
            strTxt = strTxt.replace(/[；]/g, ",");
            strTxt = strTxt.replace(/[;]/g, ",");
            strTxt = strTxt.replace(/[、]/g, ",");
            strTxt = strTxt.replace(/[,]+/g, ",");
            strTxt = strTxt.replace(/^,/g, "");
            strTxt = strTxt.replace(/,$/g, "");

            var rn = g_gamebets.AddBet(strTxt);
            if (rn == -111)
            {
                jAlert('该打法已存在', '不能添加');
                rb = false;
            }
            else
            {
                rb = AfterSaveBet(rn);
                if (rb)
                {
                    $('#dgBetsManage').datagrid({ data: g_gamebets.bets });
                    $('#dgBetsManage').datagrid('reload');

                    UpdateConfigManageButtonStatus();
                }
            }
        }
        return rb;
    });
    $('.messager-input').attr('maxlength', 20);

    var input = $(".messager-input");
    input.select();
    input.focus();
}

function OnBetsManageDel()
{
    var rows = $('#dgBetsManage').datagrid('getSelections');
    if ((rows.length < 1) || (rows.length >= g_gamebets.bets.rows.length))
        return;

    jConfirm('确定要删除当前选中的打法吗？', '请确认', function (rb)
    {
        if (rb)
        {
            var rn = g_gamebets.DeleteBets(rows);

            if (rn == 1)
            {
                $('#dgBetsManage').datagrid({ data: g_gamebets.bets });
                $('#dgBetsManage').datagrid('reload');

                UpdateConfigManageButtonStatus();
            }
        }
    });
}

function OnBetsManageRestoreDefault()
{
    jConfirm('确定要重新加入预定义的打法吗？', '请确认', function (rb)
    {
        if (rb)
        {
            var rn = g_gamebets.RestoreDefaultBets();

            if (rn == 1)
            {
                $('#dgBetsManage').datagrid({ data: g_gamebets.bets });
                $('#dgBetsManage').datagrid('reload');

                UpdateConfigManageButtonStatus();
            }
        }
    });
}

function OnBetsManageOK()
{
    $('#dgGameBets').datagrid({ data: g_gamebets.bets });
    $('#dgGameBets').datagrid('reload');
    Show_StatsGames(-1, false); // 打法（非主页）
    Show_StatsGames(-1, true); // 打法（主页）

    var div = document.getElementById("divBetsManage");
    div.style.display = "none";
}

// play records: --------------------------------------------------------------

function CPlay()
{
    this.anNum = [];
    this.nIDX = -1;
    this.Status = -1; // 1: playing; 0: paused; -1: stopped
    this.TimerID;

    function GetTimerInterval()
    {
        var nInterval = 2000;
        if (g_bttnPlaySpeed.Value() == 1)
            nInterval = 4000;
        else if (g_bttnPlaySpeed.Value() == 3)
            nInterval = 1000;

        return nInterval;
    }

    this.ChangeInterval = function()
    {
        if(this.Status == 1)
        {
            window.clearInterval(this.TimerID);
            this.TimerID = window.setInterval(OnPlayTimer, GetTimerInterval());
        }
    }

    this.ReachEnd = function ()
    {
        return (this.nIDX >= (this.anNum.length - 1));
    }

    this.Start = function (queue, nScope)
    {
        if (this.anNum.length > 0)
            this.anNum.splice(0, this.anNum.length);

        for (var n = 0; n <= queue.nIDX; ++n)
            this.anNum[n] = queue.anNum[n];

        if (nScope >= queue.anNum.length)
        {
            queue.anNum.splice(0, queue.anNum.length);
            queue.nIDX = -1;

            this.nIDX = -1;
        }
        else
        {
            var anNumTmp = [];
            var nLen = queue.anNum.length - nScope;

            for (var n = 0; n < nLen; ++n)
            {
                anNumTmp[n] = queue.anNum[n];
            }

            ResetData(anNumTmp, true);
            ShowStatitics();

            this.nIDX = nLen - 1;
        }

        this.Status = 1;

        this.TimerID = window.setInterval(OnPlayTimer, GetTimerInterval());
    }

    this.PauseContinue = function ()
    {
        if (this.Status > 0)
        {
            window.clearInterval(this.TimerID);
            this.Status = 0;
        }
        else if (this.Status == 0)
        {
            this.TimerID = window.setInterval(OnPlayTimer, GetTimerInterval());
            this.Status = 1;
        }
    }

    this.Stop = function ()
    {
        if (this.Status >= 0)
        {
            window.clearInterval(this.TimerID);
            this.Status = -1;
        }

        var bttn1 = document.getElementById("tdBttnPlayStart");
        bttn1.style.display = "";

        var bttn2 = document.getElementById("tdBttnPlayPauseContinue");
        bttn2.style.display = "none";

        var bttn = document.getElementById("tdBttnPlayStop");
        bttn.className = "bttnPlay tdSBEnabled";
        bttn.innerHTML = "退出";
    }

    this.Step = function ()
    {
        this.nIDX++;
        if (this.nIDX >= this.anNum.length)
            return -1;

        if (this.ReachEnd())
            this.Stop();

        return this.anNum[this.nIDX];
    }
}

var g_play = new CPlay();

function Show_RefreshPlayScopeButtons()
{
    g_bttnPlayScope.Show("divPlayScopeBttns");
}

function OnBttnPlayScopeClick(nIdx)
{
    g_bttnPlayScope.OnClick(nIdx);
}

function UpdatePlayScopeButtons()
{
    var td = document.getElementById("tdBttnPlayScope");
    td.innerHTML = g_bttnPlayScope.Title();
}

function Show_RefreshPlaySpeedButtons()
{
    g_bttnPlaySpeed.Show("tdPlaySpeedBttns");
}

function OnBttnPlaySpeedClick(nIdx)
{
    g_bttnPlaySpeed.OnClick(nIdx);
    g_play.ChangeInterval();
}

function UpdatePlayStatus(nCount, nTotal)
{
    var td = document.getElementById("tdPlayCount");
    td.innerHTML = nCount.toString();

    if(nTotal > 0)
    {
        td = document.getElementById("tdPlayTotal");
        td.innerHTML = nTotal.toString();
    }
}

function ShowScopeDialog(bShow)
{
    var div = document.getElementById("divPlayScope");
    div.style.display = bShow ? "" : "none";
}

function OnPlayScope()
{
    Show_RefreshPlayScopeButtons();
    ShowScopeDialog(true);
}

function OnPlayScopeOK()
{
    UpdatePlayScopeButtons();
    ShowScopeDialog(false);
}


function StopPlay()
{
    if (g_play.Status < 0)
        return;

    g_play.Stop();

    if (g_queue.anNum.length > 0)
        g_queue.anNum.splice(0, g_queue.anNum.length);

    ResetData(g_play.anNum, true);
    UpdatePlayStatus(g_play.anNum.length, -1);
    ShowStatitics();

    /*
    if (g_play.nIDX < (g_play.anNum.length - 1))
    {
        var nn = g_queue.anNum.length;
        for (var n = g_play.nIDX + 1; n < g_play.anNum.length; ++n)
            Calc_AddNum(g_play.anNum[n]);

        Calc_Sum();
        nn = g_queue.anNum.length;

        Show_AddNum();
    }
    */
}

function OnQuitStats()
{
    StopPlay();

    var div = document.getElementById("divPlayBttns");
    div.style.display = "none";

    SwitchWindow("divStats", "divMain");
}


function UpdatePlayButtons()
{
    var bttn = document.getElementById("tdBttnPlayPauseContinue");
    bttn.className = "bttnPlay " + ((g_play.Status >= 0) ? "tdSBEnabled" : "tdSBDisabled");
    if (g_play.Status == 0)
        bttn.innerHTML = "继续";
    else
        bttn.innerHTML = "暂停";

    bttn = document.getElementById("tdBttnPlayScope");
    bttn.className = "bttnPlay " + ((g_play.Status < 0) ? "tdSBEnabled" : "tdSBDisabled");

    bttn = document.getElementById("tdBttnPlayStop");
    bttn.className = "bttnPlay tdSBEnabled";
    if (g_play.Status >= 0)
        bttn.innerHTML = "结束";
    else
        bttn.innerHTML = "退出";
}

function OnPlayTimer()
{
    if (g_play.Status < 0)
        return;

    var num = g_play.Step();
    UpdatePlayButtons();
    UpdatePlayStatus(g_play.nIDX + 1, -1);
    if (num < 0)
        return;

    Calc_AddNum(num);
    Calc_Sum();
    Play_Show_AddNum();
}

function RestartPlay()
{
    StopPlay();

    g_waves.Reset(-1);
    g_play.Start(g_queue, g_bttnPlayScope.Value());
    var num = g_play.Step();
    Calc_AddNum(num);
    Calc_Sum();
    Play_Show_AddNum();

    UpdatePlayButtons();
    UpdatePlayStatus(g_play.nIDX + 1, -1);
}


function OnPlayStart()
{
    var bttn1 = document.getElementById("tdBttnPlayStart");
    bttn1.style.display = "none";

    var bttn2 = document.getElementById("tdBttnPlayPauseContinue");
    bttn2.style.display = "";

    RestartPlay();
    UpdatePlayStatus(g_play.nIDX + 1, g_play.anNum.length);
}

function OnPlayPauseContinue()
{
    g_play.PauseContinue();
    UpdatePlayButtons();
}

function OnPlayStop()
{
    if (g_play.Status >= 0)
    {
        StopPlay();
        UpdatePlayButtons();
    }
    else
    {
        OnQuitStats();
    }
}


function OnViewNum()
{
    if (g_queue.nIDX < 0)
        return;

    Show_RefreshViewNumButtons();
    Show_ViewNum();

    var div = document.getElementById("divViewNum");
    div.style.display = "";
}

function OnQuitViewNum()
{
    var div = document.getElementById("divViewNum");
    div.style.display = "none";
}

// Stats Distances ------------------------------------------------------------

function OnStatsDistanceClick(nCR)
{
    g_status.StatsDistCR = nCR;

    DrawDistance1(nCR);

    var div = document.getElementById("divStatsDistDetail");
    div.style.display = "";
}

function OnHideStatsDistDetail()
{
    var div = document.getElementById("divStatsDistDetail");
    div.style.display = "none";
}


function OnStatsDistances8Click(nCR)
{
    // 可以根据配置选项，直接显示单个数据的图，也可以先显示4个数据的图

    if (0) // 显示4个数据的图
    {
        var nCROpt = nCR / 4;

        g_status.StatsDistCROpt = nCROpt;

        DrawDistances4(nCROpt);

        var div = document.getElementById("divStatsDistances0");
        div.style.display = "none";

        var div = document.getElementById("divStatsDistances1");
        div.style.display = "";
    }
    else // 直接显示单个数据的图：
    {
        OnStatsDistanceClick(nCR);
    }
}

function OnStatsDistance1Return()
{
    var div = document.getElementById("divStatsDistances1");
    div.style.display = "none";

    var div = document.getElementById("divStatsDistances0");
    div.style.display = "";
}

// Stats ColRow Chart ---------------------------------------------------------

function OnStatsCRCClick(nCR)
{
//    g_status.StatsDistCR = nCR;

//    DrawDistance1(nCR);

    var div = document.getElementById("divStatsCRCDetail");
    div.style.display = "";
}

function OnHideStatsCRCDetail()
{
    var div = document.getElementById("divStatsCRCDetail");
    div.style.display = "none";
}

function OnStatsCRC8Click(nCR)
{
    // OnStatsCRCClick(nCR);
}




function IsInteger(obj)
{
    return (typeof obj === 'number') && (obj % 1 === 0);
}

function OnFileImport()
{
    var txt = document.getElementById("txtClipboard");
    var strValue = txt.value;

    var strErrFileName = "";

    try
    {
        var aGameData = JSON.parse(strValue);
        var nCount = aGameData.length;

        if (nCount <= 0)
            throw -1;

        if ((nCount + g_files.fs.rows.length) > MAX_FILE_COUNT)
            throw -3;

        var aName = new Array();

        for (var n = 0; n < nCount; ++n)
        {
            var gamedata = aGameData[n];
            var strName = gamedata.Name;
            if (strName == null)
                throw -1;

            strName = $.trim(gamedata.Name);
            if(strName.length <= 0)
                throw -10;

            var tms = gamedata.tms;
            if (tms == null)
                throw -1;
            var strNum = gamedata.Numbers;
            if (strNum == null)
                throw -1;

            var strname = strName.toLowerCase();
            var bDuplicated = false;
            for (var nn = 0; nn < aName.length; ++nn)
            {
                if(strname == aName[nn])
                {
                    bDuplicated = true;
                    break;
                }
            }
            if (bDuplicated)
            {
                strErrFileName = strName;
                throw -11;
            }

            aName.push(strname);

            var rtn = new CReturnArray();
            NumStringToArray(strNum, rtn);
            if (rtn.rn < 0)
                throw -2;
            var nNumCount = rtn.anVal.length;
            if(nNumCount <= 0)
                throw -2;

            aGameData[n].Count = nNumCount;

            var rn = g_files.CheckName(strName);
            if (rn == -111)
            {
                strErrFileName = strName;
                throw -11;
            }
            else if(rn < 0)
            {
                strErrFileName = strName;
                throw -12;
            }
        }

        var tm = new Date();
        tms = tm.getTime();

        for (var n = 0; n < nCount; ++n)
        {
            var gamedata = aGameData[n];
            var strName = $.trim(gamedata.Name);
            var nNumCount = gamedata.Count;
            var tms = gamedata.tms;
            var strNum = gamedata.Numbers;
            g_files.Save(strName, nNumCount, strNum, tms, tms + n, false);
        }

        $('#dgFiles').datagrid({ data: g_files.fs });
        $('#dgFiles').datagrid('reload');

        OnImportOK();
    }
    catch(e)
    {
        var nErr = -1;
        if (IsInteger(e))
            nErr = e;

        var strMsg = "数据格式不正确，请检查";

        if (nErr == -2)
            strMsg = "号码数据有问题，请检查";
        else if (nErr == -3)
            strMsg = "保存的总文件数不能超过" + MAX_FILE_COUNT.toString() + "个";
        else if (nErr == -10)
            strMsg = "名称不能为空";
        else if (nErr == -11)
            strMsg = "'" + strErrFileName + "'重名了";
        else if(nErr == -12)
            strMsg = "'" + strErrFileName + "'名称不合法";

        jAlert(strMsg, "导入失败");
    }
}

function AddGameData(aGameData, row)
{
    var strNum = ReadData(row.p);

    var gamedata = new CGameData();
    gamedata.Name = row.n;
    gamedata.tms = row.t;
    var tm = new Date(gamedata.tms);
    gamedata.SaveTime = tm.format("yyyy-MM-dd HH:mm");
    gamedata.Count = row.c;
    gamedata.Numbers = strNum;

    aGameData.push(gamedata);
}


///////////////////////////////////////////////////////////////////////////////

$(document).ready(function ()
{
    // sys change theme:
    $("#tdBttnTheme").click(function ()
    {
        if (g_status.ThemeID > 1)
            return;

        g_status.Escape = 0;

        g_status.ThemeID++;
        g_status.ThemeID = g_status.ThemeID % 2;

        Show_RefreshTheme();
    });

    // sys restart: ////////// currently not used
    $("#tdBttnRestart").click(function ()
    {
        if (g_queue.nIDX < 0)
            return;

        jConfirm('重置将清除当前所有数据！确定要重置吗？', '请确认', function (rb)
        {
            if(rb)
            {
                PageInit_Data(true);
                Show_AddNum();
            }
        });
    });

    // sys restore:
    $("#tdBttnRestore").click(function ()
    {
        if (g_queue.nIDX >= 0)
            return;

        var strNum = ReadData(DATA_NUMBERS);
        ResetDataFromNumString(strNum, "restore", null);
    });

    // sys export:
    $("#tdBttnExport").click(function ()
    {
        var clipboard = new ClipboardJS('#tdBttnExport');
        var strData = NumArrayToString(g_queue);
        $("#tdBttnExport").attr("data-clipboard-action", "copy");
        $("#tdBttnExport").attr("data-clipboard-text", strData);

        clipboard.on('success', function (e)
        {
            jAlert("数据已复制到粘贴板", "导出数据");
        });

        clipboard.on('error', function (e)
        {
            jAlert("数据复制失败", "导出数据");
        });
    });

    // sys import:
    $("#tdBttnImport").click(function ()
    {
        //var tdTitle = document.getElementById("tdImportTitle");
        var txt = document.getElementById("txtClipboard");
        //var trSpecImport = document.getElementById("trSpecImport");
        //var tdBttnDoImport = document.getElementById("tdBttnDoImport");

        //tdTitle.innerHTML = "导&nbsp;&nbsp;&nbsp;入";
        txt.value = "";
        //trSpecImport.style.display = "";
        //tdBttnDoImport.style.display = "";
        var bttn1 = document.getElementById("tdBttnDoImport");
        bttn1.style.display = "";
        var bttn2 = document.getElementById("tdBttnDoFileImport");
        bttn2.style.display = "none";
        var div = document.getElementById("divImport");
        div.style.display = "";
        txt.select();
    });

    // sys statistics:
    $("#tdBttnStatistics").click(function ()
    {
        OpenStatistics("s");
    });

    // stats games:
    $("#tdBttnStatsGames").click(function ()
    {
        OpenStatistics("g");
    });

    // stats colrow:
    $("#tdBttnStatsColRow").click(function ()
    {
        OpenStatistics("cr");
    });

    // stats colrowdig:
    $("#tdBttnStatsColRowDig").click(function ()
    {
        OpenStatistics("crd");
    });

    // stats frequencies:
    $("#tdBttnStatsFrequencies").click(function ()
    {
        OpenStatistics("f");
    });
 
    // stats distances:
    $("#tdBttnStatsDistances").click(function ()
    {
        OpenStatistics("d");
    });

    // play:
    $("#tdBttnPlay").click(function ()
    {
//        RestartPlay();
        UpdatePlayScopeButtons();

        var bttn = document.getElementById("tdBttnPlayStop");
        bttn.className = "bttnPlay tdSBEnabled";
        bttn.innerHTML = "退出";

        UpdatePlayStatus(g_queue.anNum.length, g_queue.anNum.length);

        Show_RefreshPlaySpeedButtons();
        var div = document.getElementById("divPlayBttns");
        div.style.display = "";

        OpenStatistics("play");
    });

    $("#tdBttnSave").click(function ()
    {
        if (g_queue.nIDX < 0)
            return;

        $.messager.defaults = { ok: "确定", cancel: "取消", width: 700, top: 230 };
        $.messager.prompt('保存当前数据', '请输入当前数据的名称：', function (strFileName)
        {
            var rb = true;
            if (strFileName != null)
            {
                var rn = g_files.SaveCurrent(strFileName, false);
                if (rn == -111)
                {
                    jConfirm('该名称的数据已存在，是否需要覆盖？', '请确认', function (bConfirmed)
                    {
                        if (bConfirmed)
                        {
                            rn = g_files.SaveCurrent(strFileName, true);
                            rb = AfterSaveFile(strFileName, rn);
                            if (rb)
                                $(".messager-body").window('close');
                        }
                    });

                    rb = false;
                }
                else
                {
                    rb = AfterSaveFile(strFileName, rn);
                }
            }

            return rb;
        });

        var strFileNameInit = new Date().format("yyyyMMdd-HHmm");
        var input = $(".messager-input");
        input.attr('maxlength', 20);
        input.val(strFileNameInit);
        input.select();
        input.focus();
    });

    $("#tdBttnManage").click(function ()
    {
        OpenFilesDialog();
    });

    $("#tdBttnConfig").click(function ()
    {
        $(function ()
        {
            $('#dgGameBets').datagrid({
                data: g_gamebets.bets,
                singleSelect: false,
                rowStyler: function (index, row)
                {
                    return UpdateDataGridBetsRowColor('dgGameBets', index, row);
                },
                onLoadSuccess: function (data)
                {
                    if (data)
                    {
                        $.each(data.rows, function (index, item)
                        {
                            if (g_gamebets.BetSelected(item.v))
                            {
                                $('#dgGameBets').datagrid('checkRow', index);
                                $('#dgGameBets').datagrid('refreshRow', index);
                            }
                        });
                    }
                },
                onSelect: function(index, row)
                {
                    $('#dgGameBets').datagrid('refreshRow', index);
                },
                onUnselect: function (index, row)
                {
                    $('#dgGameBets').datagrid('refreshRow', index);
                },
            });

            $('#dgGameRnds').datagrid({
                data: g_gamebets.rnds,
                singleSelect: false,
                onLoadSuccess: function (data)
                {
                    if (data)
                    {
                        $.each(data.rows, function (index, item)
                        {
                            if (g_gamebets.RndSelected(item.v))
                                $('#dgGameRnds').datagrid('checkRow', index);
                        });
                    }
                },
            });

            $('#dgARCOption').datagrid({
                data: g_gamebets.ARCOpts,
                singleSelect: false,
                onLoadSuccess: function (data)
                {
                    if (data)
                    {
                        $.each(data.rows, function (index, item)
                        {
                            if (g_gamebets.ACRSelected(item.v))
                                $('#dgARCOption').datagrid('checkRow', index);
                        });
                    }
                },
            });

        });

        var div = document.getElementById("divConfig");
        div.style.display = "";
    });

    // files operations: ------------------------------------------------------

    $("#tdBttnFileRename").click(function ()
    {
        var rows = $('#dgFiles').datagrid('getSelections');
        if (rows.length != 1)
            return;

        $.messager.defaults = { ok: "确定", cancel: "取消", width: 700, top: 230, closable: false };
        $.messager.prompt('重命名数据', '请输入该数据的新名称：', function (strFileName)
        {
            var rb = true;
            if (strFileName != null)
            {
                var strOldName = rows[0].n;

                var rn = g_files.Rename(strOldName, strFileName);

                var strMsg = "";
                var strTitle = "";
                if (rn > 0)
                {
                    strTitle = "重命名成功";
                    strMsg = "\"" + strOldName + "\"重命名为\"" + strFileName + "\"成功";

                    $('#dgFiles').datagrid({data: g_files.fs});
                    $('#dgFiles').datagrid('reload');
                }
                else
                {
                    strTitle = "重命名失败";
                    strMsg = g_files.ErrorMessage(rn);
                    rb = false;
                }

                jAlert(strMsg, strTitle);

            }
            return rb;
        });

        var input = $(".messager-input");
        input.attr('maxlength', 20);
        input.val(rows[0].n);
        input.select();
        input.focus();
    });
    
    $("#tdBttnFileDelete").click(function ()
    {
        var rows = $('#dgFiles').datagrid('getSelections');
        if (rows.length < 1)
            return;

        jConfirm('确定要删除当前选中的数据吗？', '请确认', function (rb)
        {
            if (rb)
            {
                g_files.Delete(rows);

                $('#dgFiles').datagrid({ data: g_files.fs });
                $('#dgFiles').datagrid('reload');
            }
        });
    });

    $("#tdBttnFileOpen").click(function ()
    {
        var rows = $('#dgFiles').datagrid('getSelections');
        if (rows.length != 1)
            return;

        var strNum = ReadData(rows[0].p);
        ResetDataFromNumString(strNum, "open", AfterOpenData);
    });

    $("#tdBttnFileExport").click(function ()
    {
        g_files.Load();
        var nCount = g_files.fs.rows.length;

        if (nCount <= 0)
            return;

        var aGameData = new Array();

        var rows = $('#dgFiles').datagrid('getSelections');
        if (rows.length > 0)
        {
            for (var n = 0; n < rows.length; ++n)
            {
                AddGameData(aGameData, rows[n]);
            }
        }
        else
        {
            for (var n = 0; n < nCount; ++n)
            {
                AddGameData(aGameData, g_files.fs.rows[n]);
            }
        }

        var strExport = JSON.stringify(aGameData);

        var clipboard = new ClipboardJS('#tdBttnFileExport');
        $("#tdBttnFileExport").attr("data-clipboard-action", "copy");
        $("#tdBttnFileExport").attr("data-clipboard-text", strExport);

        clipboard.on('success', function (e)
        {
            jAlert("数据已经用JSON格式导出到剪贴板", "导出数据");
        });

        clipboard.on('error', function (e)
        {
            jAlert("数据复制失败", "导出数据");
        });

    });

    $("#tdBttnFileImport").click(function ()
    {
        var txt = document.getElementById("txtClipboard");
        txt.value = "";
        var bttn1 = document.getElementById("tdBttnDoImport");
        bttn1.style.display = "none";
        var bttn2 = document.getElementById("tdBttnDoFileImport");
        bttn2.style.display = "";
        var div = document.getElementById("divImport");
        div.style.display = "";
        txt.select();
    });

});

