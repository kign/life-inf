#include <stdio.h>
#ifndef C4WA
#include <stdlib.h>
#include <string.h>
#endif
#include "life-inf.h"

const unsigned int rand_x = 179424673;
const unsigned int rand_y = 376424971;

void life_prepare_box(struct Box * w, struct Stat * stat) {
    if (w->level > 0) {
        for(int idx = 0; idx < N*N; idx ++)
            if (w->cells[idx])
                life_prepare_box(w->cells[idx], stat);
    }
    else {
        unsigned int hash = 0;
        int cnt = 0;
        for(int idx = 0; idx < N0*N0; idx ++)
            if (((struct Box0 *)w)->cells0[idx] == 1) {
                int y = idx / N0;
                int x = idx % N0;

                cnt ++;
                hash ^= (unsigned int)(x + w->x0) * rand_x + (unsigned int)(y + w->y0) * rand_y;

                for (int j = 0; j < 9; j ++) {
                    if (j == 4) continue;
                    int vx = x + j % 3 - 1;
                    int vy = y + j / 3 - 1;
                    if (0 <= vx && vx < N0 && 0 <= vy && vy < N0) {
                        int ind = vy * N0 + vx;
                        if (0 == ((struct Box0 *)w)->cells0[ind])
                            ((struct Box0 *)w)->cells0[ind] = 2;
                    }
                    else
                        if (0 == get_cell(vx + w->x0, vy + w->y0, 0))
                            set_cell(vx + w->x0, vy + w->y0, 2, 0, 0);
                }
            }
        stat->hash ^= hash;
        stat->count += cnt;
    }
}

void life_step_box(struct Box * w, int dst, int age, struct Stat * stat) {
    assert(w);
    if (w->level > 0) {
        for(int idx = 0; idx < N*N; idx ++)
            if (w->cells[idx]) {
                if (w->cells[idx]->age >= age - 1) {
                    life_step_box(w->cells[idx], dst, age, stat);
                    if (w->cells[idx]->age == age)
                        w->age = age;
                }
                // we can adjust here how aggressively release empty boxes
                else if (w->cells[idx]->age < age - 3) {
                    release_box(w->cells[idx]);
                    w->cells[idx] = (struct Box*) 0;
                }
            }
    }
    else {
#define w0 ((struct Box0 *)w)
        unsigned int hash = 0;
        int cnt = 0;
        char * start = w0->cells0 + N0*N0*(1 - dst);
        char * end = w0->cells0 + N0*N0*(2 - dst);
        for (char * p = start; p < end; p ++) {
            if (!*p) continue;
            int idx = p - start;
            int y = idx / N0;
            int x = idx % N0;
            int n = 0;
            for (int j = 0; j < 9; j ++) {
                if (j == 4) continue;
                int vx = x + j % 3 - 1;
                int vy = y + j / 3 - 1;
                n += 1 == (0 <= vx && vx < N0 && 0 <= vy && vy < N0
                            ? (int) start[vy * N0 + vx]
                            : get_cell(vx + w->x0, vy + w->y0, 1 - dst));
            }
            if ((n == 3) | ((n == 2) & (*p == 1))) {
                cnt ++;
                if (cnt == 1) w->age = age;

                hash ^= (unsigned int)(x + w->x0) * rand_x + (unsigned int)(y + w->y0) * rand_y;

                char * dst_st = w0->cells0 + N0*N0*dst;
                dst_st[idx] = (char)1;

                for (int j = 0; j < 9; j ++) {
                    if (j == 4) continue;
                    int vx = x + j % 3 - 1;
                    int vy = y + j / 3 - 1;
                    if (0 <= vx && vx < N0 && 0 <= vy && vy < N0) {
                        char * xd = dst_st + vy * N0 + vx;
                        if (*xd != 1) *xd = (char)2;
                    }
                    else if (1 != get_cell(vx + w->x0, vy + w->y0, dst))
                        set_cell(vx + w->x0, vy + w->y0, 2, dst, age);
                }
            }
        }
        stat->hash ^= hash;
        stat->count += cnt;
#undef w0
    }
}

void life_clean_plane(struct Box * w, int dst) {
    assert(w);
    if (w->level > 0) {
        for(int idx = 0; idx < N*N; idx ++)
            if (w->cells[idx])
                life_clean_plane(w->cells[idx], dst);
    }
    else
        memset((((struct Box0 *)w)->cells0 + N0*N0*dst), '\0', N0*N0);
}

void life_prepare (struct Stat * stat) {
    struct Box * world = get_world ();

    if (world) {
        stat->count = 0;
        stat->hash = 0;
        life_prepare_box(world, stat);
    }
}

void life_step (int dst, int age, struct Stat * stat) {
    struct Box * world = get_world ();

    if (world) {
        stat->count = 0;
        stat->hash = 0;
        life_clean_plane(world, dst);
        life_step_box(world, dst, age, stat);
    }
}
