#include <stdio.h>
#ifndef C4WA
#include <stdlib.h>
#include <string.h>
#endif
#include "life-inf.h"

const unsigned int rand_x = 179424673;
const unsigned int rand_y = 376424971;

void life_prepare_box(struct Box * w, int plane, struct Stat * stat) {
    if (w->level > 0) {
        for(int idx = 0; idx < N*N; idx ++)
            if (w->cells[idx])
                life_prepare_box(w->cells[idx], plane, stat);
    }
    else {
#define w0 ((struct Box0 *)w)
        unsigned int hash = 0;
        int cnt = 0;
        for(int idx = plane*(N0*N0); idx < (plane+1)*(N0*N0); idx ++)
            if (w0->cells0[idx] == 1) {
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
                        if (0 == w0->cells0[ind])
                            w0->cells0[ind] = 2;
                    }
                    else
                        if (0 == get_cell(vx + w->x0, vy + w->y0, plane))
                            set_cell(vx + w->x0, vy + w->y0, 2, plane);
                }
            }
        stat->hash ^= hash;
        stat->count += cnt;
#undef w0
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
                // we can adjust here how aggressively to release empty boxes
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

                const int rx = w->x0 + x;
                const int ry = w->y0 + y;
                if (rx < stat->xmin) stat->xmin = rx;
                if (rx > stat->xmax) stat->xmax = rx;
                if (ry < stat->ymin) stat->ymin = ry;
                if (ry > stat->ymax) stat->ymax = ry;

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
                        set_cell(vx + w->x0, vy + w->y0, 2, dst);
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

static unsigned int hash_0 = 0;
static unsigned int hash_1 = 0;
static unsigned int hash_2 = 0;
static unsigned int hash_3 = 0;

extern void life_prepare () {
    struct Box * world = get_world ();

    if (world) {
        struct Stat stat;
        stat.count = 0;
        stat.hash = 0;
        life_prepare_box(world, get_active_plane(), &stat);

        hash_0 = 0;
        hash_1 = 0;
        hash_2 = 0;
        hash_3 = stat.hash;
    }
}

extern int life_step () {
    int dst = 1 - get_active_plane();
    increment_age ();
    const int age = get_current_age ();

    struct Box * world = get_world ();
    int ret = 1;

    if (world) {
        struct Stat stat;
        stat.count = 0;
        stat.hash = 0;
        stat.xmin = 1<<30;
        stat.xmax = -stat.xmin;
        stat.ymin = stat.xmin;
        stat.ymax = stat.xmax;

        life_clean_plane(world, dst);
        life_step_box(world, dst, age, &stat);
        set_envelope(stat.xmin, stat.xmax, stat.ymin, stat.ymax);


        ret = (stat.hash == hash_0) | (stat.hash == hash_1) | (stat.hash == hash_2) | (stat.hash == hash_3);
        hash_0 = hash_1;
        hash_1 = hash_2;
        hash_2 = hash_3;
        hash_3 = stat.hash;
    }

    set_active_plane(dst);

    return ret;
}
