# TEST CASES — FILEFORGE

**Project:** 40. Heap vs Sequential File Organization Visualizer
**Module under test:** Simulator (insert, search, delete, block model, playback)
**Test type:** Manual black-box testing through the browser UI
**Environment:** Chrome / Edge (latest), local file execution, no server required

---

## 1. Test Summary

| Total Cases | Passed | Failed | Blocked |
| :--- | :--- | :--- | :--- |
| 10 | 10 | 0 | 0 |

---

## 2. Test Case Table

| TC ID | Objective | Precondition | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC01 | Insert into an empty file | Both files empty (Reset / fresh load) | Enter ID 101, Name Aarav, Dept CSE, Marks 95 → click Insert | Record appears as the only record of Block 00 in both files. Heap count = 1, Sequential count = 1, Blocks = 1. Packing factor reflects 1 of B slots used | Pass |
| TC02 | Boundary insertion — head of file | Dataset loaded with minimum key 103 | Insert ID 101 | Heap: appended at the last index of the last block. Sequential: placed at index 0, all later records shift one slot right | Pass |
| TC03 | Boundary insertion — tail of file | Dataset loaded with maximum key 128 | Insert ID 150 | Both files append at the end. A new block is allocated when the last block was already full | Pass |
| TC04 | Duplicate primary key rejected | Record 105 already exists | Enter ID 105 with any name/dept/marks → Insert | Insertion blocked. Error toast "Record 105 already exists in database." Record count unchanged in both files | Pass |
| TC05 | Invalid input validation | Any state | (a) Insert with Name blank (b) Insert with Marks = 120 | (a) Error toast asking for all record details (b) Error toast "Marks must be between 0 and 100." No record inserted in either case | Pass |
| TC06 | Binary search — odd vs even record count | Sequential file sorted, strategy = Binary Search | Search an existing key with N = 11, then again with N = 12 | Both terminate correctly. Comparisons never exceed ⌊log₂N⌋+1 (4 probes for N=11, 4 for N=12). Midpoint = ⌊(low+high)/2⌋ each probe | Pass |
| TC07 | Search for a non-existent key | Dataset loaded, key 999 absent | Enter 999 → Search → play to the end | Heap reports NOT FOUND after scanning all N records. Sequential reports NOT FOUND after the partition collapses (low > high). No crash, no infinite loop | Pass |
| TC08 | Search on a single-record file | Exactly one record present (ID 101) | Search 101, then search 102 | 101 found in 1 comparison in both files. 102 reported not found in both, with 1 comparison each | Pass |
| TC09 | Delete existing and non-existent record | Dataset loaded with key 108 | (a) Delete 108 (b) Delete 108 again | (a) Record removed from both files, blocks re-render, remaining count drops by 1 (b) Result panel shows "Record 108 does not exist" and files stay unchanged | Pass |
| TC10 | Dynamic block capacity resize | Dataset of 12 records loaded | Move BLOCK CAPACITY slider from 2 → 6 → 8 | Block count recomputes as ⌈N/B⌉ (6 → 2 → 2 blocks). Empty-slot placeholders, internal fragmentation count and packing factor all update immediately without reloading the data | Pass |

---

## 3. Additional Verification Notes

**Playback engine**
- Play, pause, step forward, step backward and reset were exercised on every search above. Stepping backward re-highlights the previous probe and does not corrupt the comparison counters.
- Dual Race Mode was run on the same key as Binary Search mode and produced identical final comparison counts, confirming the two code paths agree.

**Pointer badges**
- During Binary Search the [L], [MID] and [R] badges were checked against the values printed in the step message at each probe; records outside [low..high] were dimmed correctly.

**Theory cross-check**
- For N = 12 and B = 4 (b = 3 blocks): heap search averaged about b/2 block accesses, sequential binary search stayed within ⌈log₂b⌉ = 2 block accesses, matching the theoretical cost card displayed in the simulator.

**Interface**
- All ten cases were repeated in light mode and dark mode. No layout breakage or unreadable text was observed.
- Import of `samples/sample_dataset.json` restores 12 records with block size 3 and re-renders both files.
