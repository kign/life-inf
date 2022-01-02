#define C4WA_MM_FIXED
#include <stdio.h>
#include <stdlib.h>
#ifndef C4WA
#include <string.h>
#endif
#include "life-inf.h"

static int mm_allocated = 0;
static int mm_freed = 0;

static struct Box * world = (struct Box *) 0;

struct Box * get_world() {
    return world;
}

static int active_plane = 0;
static int env_xmin = 1<<30;
static int env_xmax = -(1<<30);
static int env_ymin = 1<<30;
static int env_ymax = -(1<<30);
static int current_age = 0;

int get_active_plane() {
    return active_plane;
}

void increment_age () {
    current_age ++;
}

int get_current_age () {
    return current_age;
}

void set_active_plane(int new_active_plane) {
    active_plane = new_active_plane;
}

struct Box * alloc_new_box (int level, int x0, int y0) {
    mm_allocated ++;
    struct Box * box = (struct Box *) malloc(level == 0? sizeof(struct Box0): sizeof(struct Box));
    memset(box, '\0', level == 0? sizeof(struct Box0): sizeof(struct Box));

    int size = N0;
    for (int k = 0; k < level; k ++)
        size *= N;

    box->level = level;
    box->x0 = x0;
    box->y0 = y0;
    box->size = size;

    return box;
}

#define alloc_new_box0(x0, y0) (struct Box0 *) alloc_new_box(0, x0, y0)

void release_box(struct Box * box) {
    mm_freed ++;

    if (box->level > 0) {
        for (int y = 0; y < N; y ++)
            for (int x = 0; x < N; x ++)
                if (box->cells[y * N + x])
                    release_box(box->cells[y * N + x]);
    }

    free(box);
}

void memory_stat() {
#ifdef C4WA
    int allocated, freed, current, in_use, capacity;

    mm_stat(&allocated, &freed, &current, &in_use, &capacity);
    // printf("A/R/C: %d/%d/%d; CAP: %d/%d\n", allocated, freed, current, in_use, capacity);
#endif
    printf("A/R %d/%d\n", mm_allocated, mm_freed);
}

void verify(struct Box * w) {
    if (w->level == 0)
        return;

    for (int y = 0; y < N; y ++)
        for (int x = 0; x < N; x ++) {
            struct Box * g = w->cells[y * N + x];
            if (g) {
                assert(g->level == w->level - 1);
                assert(g->size == w->size/N);
                assert(g->x0 == w->x0 + g->size * x);
                assert(g->y0 == w->y0 + g->size * y);

                verify(g);
            }
        }
}

void set_cell(int x, int y, int val, int plane) {
    struct Box * w;
    int t, xp, yp;
    const int verbose = 0;

    if (verbose)
        printf("set_cell(%d, %d, %d)\n", x, y, val);

    if (!world) {
        if (!val) return;
        struct Box0 * box = alloc_new_box0(x - N0/2, y - N0/2);
        box->cells0[N0 * N0 * plane + N0 * (y - box->y0) + (x - box->x0)] = (char)val;

        world = (struct Box *) box;
        return;
    }

    int size = world->size;
    if (!(world->x0 <= x && x < world->x0 + size && world->y0 <= y && y < world->y0 + size)) {
        if (!val) return;
        if (verbose)
            printf("Point %d, %d is outside the world %d, %d, %d, %d\n", x, y,
                    world->x0, world->x0 + size-1, world->y0, world->y0 + size-1);

        int xmin = world->x0;
        if (x < xmin) {
            t = xmin - x;
            if (t % size != 0) t += (size - t % size);
            xmin -= t;
        }
        int ymin = world->y0;
        if (y < ymin) {
            t = ymin - y;
            if (t % size != 0) t += (size - t % size);
            ymin -= t;
        }
        int xmax = world->x0 + size;
        if (x + 1 > xmax) {
            t = x + 1 - xmax;
            if (t % size != 0) t += (size - t % size);
            xmax += t;
        }
        int ymax = world->y0 + size;
        if (y + 1 > ymax) {
            t = y + 1 - ymax;
            if (t % size != 0) t += (size - t % size);
            ymax += t;
        }

        if (verbose)
            printf("xmin = %d, xmax = %d, ymin = %d, ymax = %d\n", xmin, xmax, ymin, ymax);

        int new_level = world->level;
        int new_size = size;
        do {
            new_size *= N;
            new_level ++;
        }
        while (new_size < xmax - xmin || new_size < ymax - ymin);

        if (verbose)
            printf("Level: %d => %d, Size: %d => %d\n", world->level, new_level, size, new_size);

        int dx = (new_size - xmax + xmin)/2;
        if (dx % size != 0) dx += (size - dx % size);
        int dy = (new_size - ymax + ymin)/2;
        if (dy % size != 0) dy += (size - dy % size);

        struct Box * new_world = alloc_new_box(new_level, xmin - dx, ymin - dy);

        w = new_world;
        int wsize = new_size/N;
        do {
            xp = (world->x0 - w->x0)/wsize;
            yp = (world->y0 - w->y0)/wsize;
            if (wsize == world->size) {
                if (verbose)
                    printf("Converged to original box @ %d, %d (size %d)\n", w->x0 + xp*wsize, w->y0 + yp*wsize, wsize);
                assert(w->x0 + xp*wsize == world->x0);
                assert(w->y0 + yp*wsize == world->y0);
                w->cells[N * yp + xp] = world;
                break;
            }
            new_level --;
            if (verbose)
                printf("w->x0 = %d, xp = %d, wsize = %d, w->y0 = %d, yp = %d\n", w->x0, xp, wsize, w->y0, yp);

            w->cells[N * yp + xp] = alloc_new_box(new_level, w->x0 + xp*wsize, w->y0 + yp*wsize);
            w = w->cells[N * yp + xp];
            wsize /= N;
        }
        while(1);
        world = new_world;
    }

    w = world;
    do {
        if (verbose)
            printf("Entering (%d,%d) into <%d,%d,%d,%d>\n", x, y, w->level, w->x0, w->y0, w->size);
        assert (w->x0 <= x && x < w->x0 + w->size && w->y0 <= y && y < w->y0 + w->size);
        if (val) w->age = current_age;
        if (w->level == 0) {
            xp = x - w->x0;
            yp = y - w->y0;
            if (verbose)
                printf("Assigned <%d,%d,%d>[%d] = %d\n", w->level, w->x0, w->y0, yp * N0 + xp, val);
            ((struct Box0 *)w)->cells0[N0 * N0 * plane + N0 * yp + xp] = (char) val;
            break;
        }
        else {
            size = w->size/N;
            xp = (x - w->x0)/size;
            yp = (y - w->y0)/size;
            if (verbose)
                printf("Going down to level %d, xp = %d, yp = %d\n", w->level - 1, xp, yp);
            if (!w->cells[yp * N + xp]) {
                if (!val) return;
                w->cells[yp * N + xp] = alloc_new_box(w->level - 1, w->x0 + xp*size, w->y0 + yp*size);
            }
#if DEBUG==1
            int t1 = w->level - 1;
            int t2 = w->x0 + xp*size;
            int t3 = w->y0 + yp*size;
#endif
            w = w->cells[yp * N + xp];

            assert(t1 == w->level);
            assert(t2 == w->x0);
            assert(t3 == w->y0);
            assert(size == w->size);
//            if (verbose)
//                printf("Expected cell <%d,%d,%d,%d>, found/created <%d,%d,%d,%d>\n",
//                        t1, t2, t3, size,
//                        w->level, w->x0, w->y0, w->size);
        }
    }
    while(1);
    if (verbose)
        printf("Done!\n");
}

int get_cell(int x, int y, int plane) {
    const int verbose = 0;
    int xp, yp, size;

    if (!world)
        return 0;

    struct Box * w = world;
    if (!(w->x0 <= x && x < w->x0 + w->size && w->y0 <= y && y < w->y0 + w->size))
        return 0;

    do {
        if (verbose)
            printf("Trying to locate (%d,%d) in <%d,%d,%d,%d>\n", x, y, w->level, w->x0, w->y0, w->size);
        assert (w->x0 <= x && x < w->x0 + w->size && w->y0 <= y && y < w->y0 + w->size);
        if (w->level == 0) {
            xp = x - w->x0;
            yp = y - w->y0;
            if (verbose)
                printf("Got to the bottom <%d,%d,%d>[%d]\n", w->level, w->x0, w->y0, yp * N0 + xp);
            return (int)((struct Box0 *)w)->cells0[N0 * N0 * plane + N0 * yp + xp];
        }
        else {
            size = w->size/N;
            xp = (x - w->x0)/size;
            yp = (y - w->y0)/size;
            if (verbose)
                printf("Going down to level %d, xp = %d, yp = %d\n", w->level - 1, xp, yp);
            w = w->cells[yp * N + xp];
        }
    }
    while(w);
    return 0;
}

void life_infin_print(int x0, int x1, int y0, int y1, int plane, int dbg) {
    for(int y = y0; y <= y1; y ++) {
        for(int x = x0; x <= x1; x ++) {
            int val = (int) get_cell(x,y,plane);
            printf(val == 1? "X" : (((val == 2) & dbg)?"+":"."));
        }
        printf("\n");
    }
}

void find_envelope_box(struct Box * w, int plane, int * xmin, int * xmax, int * ymin, int * ymax) {
    if (w->level > 0) {
        for(int idx = 0; idx < N*N; idx ++)
            if (w->cells[idx])
                find_envelope_box(w->cells[idx], plane, xmin, xmax, ymin, ymax);
    }
    else {
#define w0 ((struct Box0 *)w)
        char * start = w0->cells0 + N0*N0*plane;
        char * end = w0->cells0 + N0*N0*(1 + plane);
        for (char * p = start; p < end; p ++) {
            if (*p != 1) continue;
            int idx = p - start;
            int y = w->y0 + idx / N0;
            int x = w->x0 + idx % N0;
            if (y < *ymin)
                *ymin = y;
            if (y > *ymax)
                *ymax = y;
            if (x < *xmin)
                *xmin = x;
            if (x > *xmax)
                *xmax = x;
        }

#undef w0
    }
}

extern int * find_envelope() {
    int env[4];
    int * ret = env;

    env[0] = env_xmin;
    env[1] = env_xmax;
    env[2] = env_ymin;
    env[3] = env_ymax;

//    printf("Envelope: X[%d, %d], Y[%d, %d]\n", env[0], env[1], env[2], env[3]);
    return ret;
}

void set_envelope(int xmin, int xmax, int ymin, int ymax) {
    env_xmin = xmin;
    env_xmax = xmax;
    env_ymin = ymin;
    env_ymax = ymax;
}

void recompute_envelope() {
    int xmin, xmax, ymin, ymax;
    find_envelope_box(world, active_plane, &xmin, &xmax, &ymin, &ymax);
    printf("recompute_envelope: got %d %d %d %d\n", xmin, xmax, ymin, ymax);
    set_envelope(xmin, xmax, ymin, ymax);
}

void set_region(int x0, int y0, int sX, int sY, char * src) {
    for(int y = 0; y < sY; y ++)
        for (int x = 0; x < sX; x ++)
            set_cell(x + x0, y + y0, src[y * sX + x] == 'x', active_plane);

    recompute_envelope ();
}

void read_region_box(struct Box * w, int plane, char * target, int x0, int y0, int sX, int sY) {
    if (w->x0 >= x0 + sX || w->y0 >= y0 + sY || w->x0 + w->size <= x0 || w->y0 + w->size <= y0)
        return;

//    printf("=> [%d] %d, %d\n", w->level, w->x0, w->y0);

    if (w->level > 0) {
//        if (w->x0 + N <= x0 || w->y0 + N <= y0)
//            return;
//        printf("cont. [%d] %d, %d\n", w->level, w->x0, w->y0);
        for(int idx = 0; idx < N*N; idx ++)
            if (w->cells[idx])
                read_region_box(w->cells[idx], plane, target, x0, y0, sX, sY);
    }
    else {
#define w0 ((struct Box0 *)w)
//        if (w->x0 + N0 <= x0 || w->y0 + N0 <= y0)
//            return;
//        printf("cont. [%d] %d, %d\n", w->level, w->x0, w->y0);

        assert(w->x0 + N0 > x0 && w->y0 + N0 > y0);

        int xs = max(0, x0 - w->x0);
        int ys = max(0, y0 - w->y0);
        int xe = min(N0, x0 - w->x0 + sX);
        int ye = min(N0, y0 - w->y0 + sY);

//        printf("xs = %d, ys = %d, xe = %d, ye = %d\n", xs, ys, xe, ye);

        assert(0 <= xs && xs < N0);
        assert(0 <= ys && ys < N0);
        assert(0 < xe && xe <= N0);
        assert(0 < ye && ye <= N0);
        assert(xs < xe);
        assert(ys < ye);

        for (int y = ys; y < ye; y ++) {
            int tx = w->x0 + xs - x0;
            int ty = w->y0 + y - y0;
//            printf("y = %d, tx = %d, ty = %d\n", y, tx, ty);

            assert(0 <= tx && tx < sX);
            assert(0 <= ty && ty < sY);

//            printf("Copying %d bytes to %d\n", xe - xs, sX * ty + tx);
            memcpy(target + (sX * ty + tx), w0->cells0 + N0*N0*plane + y*N0 + xs, xe - xs);
        }
#undef w0
    }
}

extern char * read_region(int x0, int y0, int sX, int sY) {
//    printf("read_region(plane=%d, x0=%d, y0=%d, sX=%d, sY=%d)\n", plane, x0, y0, sX, sY);

    if (sX * sY > RESERVED_REGION) {
        printf("Asked for %d cells, over the limit %d\n", sX * sY, RESERVED_REGION);
        return 0;
    }
#ifdef C4WA
    char * target = __builtin_memory + __builtin_offset;
#else
    char * target = malloc(sX * sY);
#endif

    memset(target, '\0', sX * sY);
    if (world)
        read_region_box(world, active_plane, target, x0, y0, sX, sY);

    return target;
}

void read_region_box_scale(struct Box * w, int plane, char * target, int x0, int y0, int sX, int sY, int scale) {
    if (w->x0 >= x0 + sX*scale || w->y0 >= y0 + sY*scale || w->x0 + w->size <= x0 || w->y0 + w->size <= y0)
        return;

    if (w->level > 0) {
        for(int idx = 0; idx < N*N; idx ++)
            if (w->cells[idx])
                read_region_box_scale(w->cells[idx], plane, target, x0, y0, sX, sY, scale);
    }
    else {
#define w0 ((struct Box0 *)w)
        // Note that w->size == N0
        assert(w->x0 + N0 > x0 && w->y0 + N0 > y0);

        int xs = max(0, x0 - w->x0);
        int ys = max(0, y0 - w->y0);
        int xe = min(N0, x0 - w->x0 + sX*scale);
        int ye = min(N0, y0 - w->y0 + sY*scale);

        assert(0 <= xs && xs < N0);
        assert(0 <= ys && ys < N0);
        assert(0 < xe && xe <= N0);
        assert(0 < ye && ye <= N0);
        assert(xs < xe);
        assert(ys < ye);

        for (int y = ys; y < ye; y ++)
            for(int x = xs; x < xe; x ++)
                if (w0->cells0[N0*N0*plane + y*N0 + x]) {
                    int tx = (w->x0 + x - x0)/scale;
                    int ty = (w->y0 + y - y0)/scale;

                    assert(0 <= tx && tx < sX);
                    assert(0 <= ty && ty < sY);

                    target[sX * ty + tx] ++;
            }
#undef w0
    }
}

extern char * read_region_scale(int x0, int y0, int sX, int sY, int scale) {
    assert(1 <= scale && scale <= 100);

    if (sX * sY > RESERVED_REGION) {
        printf("Asked for %d cells, over the limit %d\n", sX * sY, RESERVED_REGION);
        return 0;
    }
#ifdef C4WA
    char * target = __builtin_memory + __builtin_offset;
#else
    char * target = malloc(sX * sY);
#endif

    memset(target, '\0', sX * sY);
    if (world)
        read_region_box_scale(world, active_plane, target, x0, y0, sX, sY, scale);

    return target;
}

extern void life_set_cell(int x, int y, int val) {
    assert(val == 0 || val == 1);

    set_cell(x, y, val, active_plane);

    if (val == 1) {
        if (x < env_xmin) env_xmin = x;
        if (x > env_xmax) env_xmax = x;
        if (y < env_ymin) env_ymin = y;
        if (y > env_ymax) env_ymax = y;
    }
    else if (world && (x == env_xmin || x == env_xmax || y == env_ymin || y == env_ymax))
        recompute_envelope ();
}

extern int life_get_cell(int x, int y) {
    return 1 == get_cell(x, y, active_plane);
}

extern void clear() {
    release_box(world);
    world = 0;
    env_xmin = 1<<30;
    env_xmax = -(1<<30);
    env_ymin = 1<<30;
    env_ymax = -(1<<30);
}